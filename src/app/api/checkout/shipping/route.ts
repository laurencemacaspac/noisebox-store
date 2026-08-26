import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type CartItem = {
  productId: number;
  quantity: number;
};

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
  quantity: number;
  itemType: string;
};

function getItemType(format: string | null): string {
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
   * Temporary fallback while we're testing
   * the marketplace with vinyl.
   */
  return "vinyl";
}

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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const cartItems =
      body.cartItems as CartItem[];

    /*
     * ISO country code supplied by checkout.
     *
     * Examples:
     *
     * US = United States
     * PH = Philippines
     * JP = Japan
     * GB = United Kingdom
     */
    const country =
      typeof body.country === "string"
        ? body.country.trim().toUpperCase()
        : "";

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

    const isDomestic =
      country === "US";

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

    /*
     * Validate cart data.
     */
    for (const item of cartItems) {
      if (
        !Number.isInteger(item.productId) ||
        item.productId <= 0
      ) {
        return NextResponse.json(
          {
            error: "Invalid listing ID.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return NextResponse.json(
          {
            error: "Invalid cart quantity.",
          },
          {
            status: 400,
          },
        );
      }
    }

    const listingIds = [
      ...new Set(
        cartItems.map(
          (item) => item.productId,
        ),
      ),
    ];

    /*
     * Retrieve authoritative seller/listing
     * information.
     */
    const {
      data: listings,
      error: listingsError,
    } = await supabaseAdmin
      .from("seller_listings")
      .select(`
        id,
        seller_id,
        quantity,
        status,

        release:releases!seller_listings_release_id_fkey (
          id,
          format
        )
      `)
      .in("id", listingIds);

    if (listingsError) {
      throw listingsError;
    }

    if (
      !listings ||
      listings.length !== listingIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "One or more listings are unavailable.",
        },
        {
          status: 400,
        },
      );
    }

    const checkoutItems: CheckoutItem[] =
      cartItems.map((cartItem) => {
        const listing = listings.find(
          (row) =>
            row.id === cartItem.productId,
        );

        if (!listing) {
          throw new Error(
            "A cart listing could not be found.",
          );
        }

        if (listing.status !== "for_sale") {
          throw new Error(
            "One or more items are no longer for sale.",
          );
        }

        if (
          cartItem.quantity >
          Number(listing.quantity)
        ) {
          throw new Error(
            "One or more items no longer have enough inventory.",
          );
        }

        const release = Array.isArray(
          listing.release,
        )
          ? listing.release[0]
          : listing.release;

        if (!release) {
          throw new Error(
            "Release information is missing.",
          );
        }

        return {
          listingId: listing.id,
          sellerId: listing.seller_id,
          quantity: cartItem.quantity,
          itemType: getItemType(
            release.format,
          ),
        };
      });

    /*
     * Load active shipping rates.
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
      rateData.map((rate) => ({
        rate_type:
          rate.rate_type as ShippingRate["rate_type"],

        item_type:
          rate.item_type,

        min_quantity:
          Number(rate.min_quantity),

        max_quantity:
          rate.max_quantity === null
            ? null
            : Number(
                rate.max_quantity,
              ),

        rate: Number(rate.rate),
      }));

    /*
     * Group cart items by seller.
     */
    const sellerGroups = new Map<
      number,
      CheckoutItem[]
    >();

    for (const item of checkoutItems) {
      const current =
        sellerGroups.get(
          item.sellerId,
        ) ?? [];

      current.push(item);

      sellerGroups.set(
        item.sellerId,
        current,
      );
    }

    const sellerCount =
      sellerGroups.size;

    /*
     * DIRECT SHIPPING
     *
     * Every seller creates their own
     * shipment directly to the buyer.
     *
     * NOTE:
     * Our current rates are test rates.
     * International carrier pricing will
     * eventually replace these values.
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

    /*
     * IMPORTANT BUSINESS RULE
     *
     * Noisebox consolidation is ONLY
     * available when:
     *
     * 1. Destination is outside the US.
     * 2. Order contains multiple sellers.
     */
    const hubAvailable =
      !isDomestic &&
      sellerCount > 1;

    let hubShipping:
      | number
      | null = null;

    if (hubAvailable) {
      let sellersToHub = 0;

      /*
       * Each seller ships domestically
       * to the Noisebox hub.
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

        sellersToHub +=
          findRate(
            rates,
            "seller_to_hub",
            itemType,
            quantity,
          );
      }

      /*
       * Final consolidated shipment:
       *
       * Noisebox Hub → international buyer.
       *
       * These are still TEST rates.
       * Later USPS/carrier pricing will use
       * the destination country here.
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

      const hubToBuyer =
        findRate(
          rates,
          "hub_to_buyer",
          consolidatedItemType,
          totalQuantity,
        );

      hubShipping =
        sellersToHub +
        hubToBuyer;
    }

    /*
     * Currency rounding.
     */
    directShipping =
      Math.round(
        directShipping * 100,
      ) / 100;

    if (
      hubShipping !== null
    ) {
      hubShipping =
        Math.round(
          hubShipping * 100,
        ) / 100;
    }

    return NextResponse.json({
      country,
      isDomestic,
      sellerCount,
      directShipping,
      hubShipping,
      hubAvailable,
    });
  } catch (error) {
    console.error(
      "Shipping quote error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to calculate shipping.";

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