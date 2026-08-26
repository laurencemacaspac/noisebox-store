import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!,
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type CartItem = {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  image: string;
};

type ShippingMethod = "direct" | "hub";

type ShippingRate = {
  rate_type:
    | "seller_to_buyer"
    | "seller_to_hub"
    | "hub_to_buyer";

  item_type: string;
  min_quantity: number;
  max_quantity: number | null;
  rate: number;
};

type CheckoutItem = {
  listingId: number;
  sellerId: number;
  releaseId: number;

  artist: string | null;
  title: string;
  format: string | null;

  mediaCondition: string | null;
  sleeveCondition: string | null;

  quantity: number;
  unitPrice: number;
  lineTotal: number;

  itemType: string;
};

/*
 * Convert the release format into one of the
 * item types understood by shipping_rates.
 */
function getItemType(
  format: string | null,
): string {
  const value = (format ?? "").toLowerCase();

  if (
    value.includes("vinyl") ||
    value.includes("lp") ||
    value.includes('12"') ||
    value.includes('10"') ||
    value.includes('7"')
  ) {
    return "vinyl";
  }

  if (
    value.includes("cd") ||
    value.includes("compact disc")
  ) {
    return "cd";
  }

  if (value.includes("cassette")) {
    return "cassette";
  }

  /*
   * Temporary fallback while we're primarily
   * testing the marketplace with records.
   */
  return "vinyl";
}

/*
 * Find the applicable temporary shipping rate.
 */
function findRate(
  rates: ShippingRate[],
  rateType: ShippingRate["rate_type"],
  itemType: string,
  quantity: number,
) {
  const rate = rates.find((row) => {
    if (row.rate_type !== rateType) {
      return false;
    }

    if (row.item_type !== itemType) {
      return false;
    }

    if (quantity < row.min_quantity) {
      return false;
    }

    if (
      row.max_quantity !== null &&
      quantity > row.max_quantity
    ) {
      return false;
    }

    return true;
  });

  if (!rate) {
    throw new Error(
      `No ${rateType} shipping rate exists for ${quantity} ${itemType} item(s).`,
    );
  }

  return Number(rate.rate);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function POST(
  request: Request,
) {
  let createdOrderId: number | null =
    null;

  try {
    /*
     * Checkout sends:
     *
     * cartItems
     * shippingMethod
     * country
     * shippingAddress
     */
    const body = await request.json();

    const cartItems =
      body.cartItems as CartItem[];

    const requestedShippingMethod =
      body.shippingMethod as ShippingMethod;

    const country =
      typeof body.country === "string"
        ? body.country
            .trim()
            .toUpperCase()
        : "";

    const shippingAddress =
      body.shippingAddress ?? {};

    /*
     * Basic validation.
     */
    if (
      !Array.isArray(cartItems) ||
      cartItems.length === 0
    ) {
      return NextResponse.json(
        {
          error: "Cart is empty.",
        },
        {
          status: 400,
        },
      );
    }

    if (!country) {
      return NextResponse.json(
        {
          error:
            "Please select a shipping country.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      requestedShippingMethod !==
        "direct" &&
      requestedShippingMethod !== "hub"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid shipping method.",
        },
        {
          status: 400,
        },
      );
    }

    for (const item of cartItems) {
      if (
        !Number.isInteger(
          item.productId,
        ) ||
        item.productId <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid listing ID.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        !Number.isInteger(
          item.quantity,
        ) ||
        item.quantity <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid cart quantity.",
          },
          {
            status: 400,
          },
        );
      }
    }

    const isDomestic =
      country === "US";

    /*
     * Retrieve authoritative listing data.
     *
     * Browser prices and seller information
     * are NEVER trusted.
     */
    const listingIds = [
      ...new Set(
        cartItems.map(
          (item) =>
            item.productId,
        ),
      ),
    ];

    const {
      data: listings,
      error: listingsError,
    } = await supabaseAdmin
      .from("seller_listings")
      .select(`
        id,
        seller_id,
        release_id,
        price,
        quantity,
        media_condition,
        sleeve_condition,
        status,

        release:releases!seller_listings_release_id_fkey (
          id,
          artist,
          title,
          format
        )
      `)
      .in("id", listingIds);

    if (listingsError) {
      throw listingsError;
    }

    if (
      !listings ||
      listings.length !==
        listingIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "One or more items in your cart are no longer available.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Build trusted checkout items.
     */
    const checkoutItems: CheckoutItem[] =
      cartItems.map(
        (cartItem) => {
          const listing =
            listings.find(
              (row) =>
                row.id ===
                cartItem.productId,
            );

          if (!listing) {
            throw new Error(
              "A cart listing could not be found.",
            );
          }

          if (
            listing.status !==
            "for_sale"
          ) {
            throw new Error(
              "One or more items are no longer for sale.",
            );
          }

          if (
            Number(
              listing.quantity,
            ) <= 0
          ) {
            throw new Error(
              "One or more items are sold out.",
            );
          }

          if (
            cartItem.quantity >
            Number(
              listing.quantity,
            )
          ) {
            throw new Error(
              "One or more items no longer have enough inventory.",
            );
          }

          const release =
            Array.isArray(
              listing.release,
            )
              ? listing.release[0]
              : listing.release;

          if (!release) {
            throw new Error(
              "Release information is missing for a cart item.",
            );
          }

          const unitPrice =
            Number(
              listing.price,
            );

          if (
            !Number.isFinite(
              unitPrice,
            ) ||
            unitPrice <= 0
          ) {
            throw new Error(
              "A listing has an invalid price.",
            );
          }

          return {
            listingId:
              listing.id,

            sellerId:
              listing.seller_id,

            releaseId:
              listing.release_id,

            artist:
              release.artist,

            title:
              release.title,

            format:
              release.format,

            mediaCondition:
              listing.media_condition,

            sleeveCondition:
              listing.sleeve_condition,

            quantity:
              cartItem.quantity,

            unitPrice,

            lineTotal:
              unitPrice *
              cartItem.quantity,

            itemType:
              getItemType(
                release.format,
              ),
          };
        },
      );

    /*
     * Determine how many different sellers
     * are participating in this order.
     */
    const sellerGroups =
      new Map<
        number,
        CheckoutItem[]
      >();

    for (const item of checkoutItems) {
      const existing =
        sellerGroups.get(
          item.sellerId,
        ) ?? [];

      existing.push(item);

      sellerGroups.set(
        item.sellerId,
        existing,
      );
    }

    const sellerCount =
      sellerGroups.size;

    /*
     * Noisebox consolidation eligibility:
     *
     * - destination must be international
     * - order must contain multiple sellers
     */
    const hubAvailable =
      !isDomestic &&
      sellerCount > 1;

    /*
     * SECURITY / BUSINESS RULE:
     *
     * A browser must not be able to manually
     * submit "hub" for an ineligible order.
     */
    if (
      requestedShippingMethod ===
        "hub" &&
      !hubAvailable
    ) {
      return NextResponse.json(
        {
          error:
            "Noisebox Consolidated Shipping is not available for this order.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Load the temporary shipping rates.
     *
     * Later this calculation layer can be
     * replaced with USPS API rates.
     */
    const {
      data: rateData,
      error: ratesError,
    } = await supabaseAdmin
      .from("shipping_rates")
      .select(`
        rate_type,
        item_type,
        min_quantity,
        max_quantity,
        rate
      `)
      .eq("active", true);

    if (ratesError) {
      throw ratesError;
    }

    if (!rateData) {
      throw new Error(
        "Shipping rates could not be loaded.",
      );
    }

    const rates: ShippingRate[] =
      rateData.map((row) => ({
        rate_type:
          row.rate_type as ShippingRate["rate_type"],

        item_type:
          row.item_type,

        min_quantity:
          Number(
            row.min_quantity,
          ),

        max_quantity:
          row.max_quantity ===
          null
            ? null
            : Number(
                row.max_quantity,
              ),

        rate: Number(row.rate),
      }));

    /*
     * Calculate DIRECT shipping.
     *
     * Each seller sends their shipment
     * directly to the buyer.
     */
    let directShipping = 0;

    for (
      const sellerItems
      of sellerGroups.values()
    ) {
      const itemTypes = [
        ...new Set(
          sellerItems.map(
            (item) =>
              item.itemType,
          ),
        ),
      ];

      const itemType =
        itemTypes.length === 1
          ? itemTypes[0]
          : "mixed";

      const quantity =
        sellerItems.reduce(
          (total, item) =>
            total +
            item.quantity,
          0,
        );

      directShipping +=
        findRate(
          rates,
          "seller_to_buyer",
          itemType,
          quantity,
        );
    }

    directShipping =
      roundMoney(
        directShipping,
      );

    /*
     * HUB shipping breakdown.
     *
     * sellerToHubTotal:
     * sellers -> Noisebox Hub
     *
     * hubToBuyerTotal:
     * Noisebox Hub -> buyer
     *
     * shippingHubId:
     * active hub used for this order
     */
    let hubShipping:
      | number
      | null = null;

    let sellerToHubTotal = 0;

    let hubToBuyerTotal = 0;

    let shippingHubId:
      | number
      | null = null;

    if (hubAvailable) {
      /*
       * Find the currently active Noisebox hub.
       *
       * Do not hard-code ID 1. This allows the
       * active hub to be changed later without
       * rewriting checkout.
       */
      const {
        data: activeHub,
        error: activeHubError,
      } = await supabaseAdmin
        .from("shipping_hubs")
        .select("id")
        .eq("active", true)
        .order("id", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      if (activeHubError) {
        throw activeHubError;
      }

      if (!activeHub) {
        /*
         * Hub shipping is only relevant when
         * the buyer actually selected it.
         *
         * If direct shipping was selected,
         * checkout can continue without a hub.
         */
        if (
          requestedShippingMethod ===
          "hub"
        ) {
          throw new Error(
            "Noisebox Consolidated Shipping is temporarily unavailable because no active shipping hub exists.",
          );
        }
      } else {
        shippingHubId =
          Number(activeHub.id);

        /*
         * Each seller sends one shipment
         * to the Noisebox Hub.
         */
        for (
          const sellerItems
          of sellerGroups.values()
        ) {
          const itemTypes = [
            ...new Set(
              sellerItems.map(
                (item) =>
                  item.itemType,
              ),
            ),
          ];

          const itemType =
            itemTypes.length === 1
              ? itemTypes[0]
              : "mixed";

          const quantity =
            sellerItems.reduce(
              (total, item) =>
                total +
                item.quantity,
              0,
            );

          sellerToHubTotal +=
            findRate(
              rates,
              "seller_to_hub",
              itemType,
              quantity,
            );
        }

        sellerToHubTotal =
          roundMoney(
            sellerToHubTotal,
          );

        /*
         * Once all seller packages reach
         * Noisebox, they become one
         * consolidated shipment.
         */
        const allItemTypes = [
          ...new Set(
            checkoutItems.map(
              (item) =>
                item.itemType,
            ),
          ),
        ];

        const consolidatedItemType =
          allItemTypes.length === 1
            ? allItemTypes[0]
            : "mixed";

        const totalQuantity =
          checkoutItems.reduce(
            (total, item) =>
              total +
              item.quantity,
            0,
          );

        hubToBuyerTotal =
          findRate(
            rates,
            "hub_to_buyer",
            consolidatedItemType,
            totalQuantity,
          );

        hubToBuyerTotal =
          roundMoney(
            hubToBuyerTotal,
          );

        hubShipping =
          roundMoney(
            sellerToHubTotal +
              hubToBuyerTotal,
          );
      }
    }

    /*
     * Server chooses the final shipping
     * amount from its own calculations.
     *
     * We NEVER accept a shipping price
     * supplied by the browser.
     */
    const shippingTotal =
      requestedShippingMethod ===
        "hub"
        ? hubShipping
        : directShipping;

    if (
      shippingTotal === null ||
      !Number.isFinite(
        shippingTotal,
      ) ||
      shippingTotal < 0
    ) {
      throw new Error(
        "Unable to determine the shipping total.",
      );
    }

    /*
     * Preserve the shipping breakdown on
     * the order itself.
     *
     * DIRECT:
     *
     * seller_shipping_total =
     *   sellers -> buyer
     *
     * hub_shipping_total = 0
     * shipping_hub_id = null
     *
     *
     * HUB:
     *
     * seller_shipping_total =
     *   sellers -> hub
     *
     * hub_shipping_total =
     *   hub -> buyer
     *
     * shipping_hub_id =
     *   active Noisebox hub
     */
    const sellerShippingTotal =
      requestedShippingMethod ===
      "hub"
        ? sellerToHubTotal
        : directShipping;

    const hubShippingTotal =
      requestedShippingMethod ===
      "hub"
        ? hubToBuyerTotal
        : 0;

    const orderShippingHubId =
      requestedShippingMethod ===
      "hub"
        ? shippingHubId
        : null;

    if (
      requestedShippingMethod ===
        "hub" &&
      orderShippingHubId === null
    ) {
      throw new Error(
        "Unable to determine the shipping hub.",
      );
    }

    /*
     * Merchandise subtotal.
     */
    const subtotal =
      roundMoney(
        checkoutItems.reduce(
          (total, item) =>
            total +
            item.lineTotal,
          0,
        ),
      );

    const total =
      roundMoney(
        subtotal +
          shippingTotal,
      );

    /*
     * Create the Noisebox order.
     */
    const {
      data: order,
      error: orderError,
    } = await supabaseAdmin
      .from("orders")
      .insert({
        status: "pending",

        subtotal,

        /*
         * Amount charged to the buyer for
         * shipping.
         */
        shipping_total:
          shippingTotal,

        /*
         * How this order will be fulfilled.
         */
        shipping_method:
          requestedShippingMethod,

        /*
         * Direct:
         * sellers -> buyer
         *
         * Hub:
         * sellers -> hub
         */
        seller_shipping_total:
          sellerShippingTotal,

        /*
         * Direct = 0
         *
         * Hub:
         * Noisebox hub -> buyer
         */
        hub_shipping_total:
          hubShippingTotal,

        /*
         * Only consolidated orders have a
         * Noisebox shipping hub.
         */
        shipping_hub_id:
          orderShippingHubId,

        total,

        currency: "usd",

        /*
         * Save the buyer and shipping address on the
         * Noisebox order so sellers can fulfill it.
         */
        buyer_email:
          typeof shippingAddress.email === "string"
            ? shippingAddress.email.trim()
            : null,

        shipping_name:
          typeof shippingAddress.fullName === "string"
            ? shippingAddress.fullName.trim()
            : null,

        shipping_address_line1:
          typeof shippingAddress.address === "string"
            ? shippingAddress.address.trim()
            : null,

        shipping_address_line2:
          typeof shippingAddress.address2 === "string" &&
          shippingAddress.address2.trim()
            ? shippingAddress.address2.trim()
            : null,

        shipping_city:
          typeof shippingAddress.city === "string"
            ? shippingAddress.city.trim()
            : null,

        shipping_state:
          typeof shippingAddress.stateProvince === "string"
            ? shippingAddress.stateProvince.trim()
            : null,

        shipping_postal_code:
          typeof shippingAddress.postalCode === "string"
            ? shippingAddress.postalCode.trim()
            : null,

        shipping_country: country,
      })
      .select("id")
      .single();

    if (orderError) {
      throw orderError;
    }

    createdOrderId =
      order.id;

    /*
     * Save the purchased listing snapshots.
     */
    const orderItems =
      checkoutItems.map(
        (item) => ({
          order_id:
            order.id,

          listing_id:
            item.listingId,

          seller_id:
            item.sellerId,

          release_id:
            item.releaseId,

          artist:
            item.artist,

          title:
            item.title,

          format:
            item.format,

          media_condition:
            item.mediaCondition,

          sleeve_condition:
            item.sleeveCondition,

          quantity:
            item.quantity,

          unit_price:
            item.unitPrice,

          line_total:
            item.lineTotal,

          fulfillment_status:
            "awaiting_payment",
        }),
      );

    const {
      error: orderItemsError,
    } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems);

    if (orderItemsError) {
      throw orderItemsError;
    }

    const origin =
      new URL(
        request.url,
      ).origin;

    /*
     * Build Stripe product lines.
     */
    const stripeLineItems:
      Stripe.Checkout.SessionCreateParams.LineItem[] =
      checkoutItems.map(
        (item) => ({
          quantity:
            item.quantity,

          price_data: {
            currency: "usd",

            unit_amount:
              Math.round(
                item.unitPrice *
                  100,
              ),

            product_data: {
              name: item.artist
                ? `${item.artist} - ${item.title}`
                : item.title,
            },
          },
        }),
      );

    /*
     * Add the SERVER-CALCULATED shipping
     * charge as its own Stripe line.
     *
     * This makes Stripe's total match
     * the Noisebox checkout total.
     */
    if (shippingTotal > 0) {
      stripeLineItems.push({
        quantity: 1,

        price_data: {
          currency: "usd",

          unit_amount:
            Math.round(
              shippingTotal *
                100,
            ),

          product_data: {
            name:
              requestedShippingMethod ===
              "hub"
                ? "Noisebox Consolidated Shipping"
                : "Shipping",
          },
        },
      });
    }

    /*
     * Create Stripe Checkout.
     */
    const session =
      await stripe.checkout.sessions.create({
        mode: "payment",

        line_items:
          stripeLineItems,

        /*
         * Let Stripe collect the buyer's
         * email if it wasn't supplied.
         */
        customer_email:
          typeof shippingAddress.email ===
            "string" &&
          shippingAddress.email.trim()
            ? shippingAddress.email.trim()
            : undefined,

        metadata: {
          noisebox_order_id:
            String(order.id),

          shipping_method:
            requestedShippingMethod,

          destination_country:
            country,

          seller_count:
            String(
              sellerCount,
            ),

          /*
           * Useful later when processing
           * consolidated shipments.
           */
          shipping_hub_id:
            orderShippingHubId ===
            null
              ? ""
              : String(
                  orderShippingHubId,
                ),
        },

        success_url:
          `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,

        /*
         * Return to CHECKOUT rather than the
         * cart if the buyer cancels Stripe.
         *
         * Their cart remains intact.
         */
        cancel_url:
          `${origin}/checkout`,
      });

    if (!session.url) {
      throw new Error(
        "Stripe did not return a checkout URL.",
      );
    }

    /*
     * Connect our Noisebox order to
     * the Stripe Checkout Session.
     */
    const {
      error:
        sessionUpdateError,
    } = await supabaseAdmin
      .from("orders")
      .update({
        stripe_checkout_session_id:
          session.id,
      })
      .eq(
        "id",
        order.id,
      );

    if (
      sessionUpdateError
    ) {
      throw sessionUpdateError;
    }

    return NextResponse.json({
      url: session.url,

      /*
       * Useful during development.
       */
      orderId:
        order.id,

      subtotal,

      shipping:
        shippingTotal,

      sellerShipping:
        sellerShippingTotal,

      hubShipping:
        hubShippingTotal,

      shippingHubId:
        orderShippingHubId,

      total,

      shippingMethod:
        requestedShippingMethod,

      country,
    });
  } catch (error) {
    console.error(
      "Stripe Checkout error:",
      error,
    );

    /*
     * If something failed after we created
     * the order, don't leave it looking like
     * a valid pending checkout.
     */
    if (
      createdOrderId !==
      null
    ) {
      await supabaseAdmin
        .from("orders")
        .update({
          status:
            "cancelled",
        })
        .eq(
          "id",
          createdOrderId,
        );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create checkout session.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}