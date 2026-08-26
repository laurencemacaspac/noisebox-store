"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  /*
   * productId currently represents seller_listings.id.
   */
  productId: number;

  /*
   * sellerId tells the storefront which seller owns
   * this listing.
   *
   * The checkout API will still verify the real
   * seller ID from Supabase before creating an order.
   */
  sellerId: number;

  productName: string;
  price: number;
  image: string;
  quantity: number;
};

type CartContextType = {
  cartItems: CartItem[];
  cartLoaded: boolean;

  addToCart: (item: CartItem) => void;

  removeFromCart: (productId: number) => void;

  updateQuantity: (
    productId: number,
    quantity: number,
  ) => void;

  clearCart: () => void;
};

const CartContext = createContext<
  CartContextType | undefined
>(undefined);

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [cartItems, setCartItems] = useState<
    CartItem[]
  >([]);

  const [cartLoaded, setCartLoaded] =
    useState(false);

  /*
   * Restore the cart from localStorage.
   */
  useEffect(() => {
    const savedCart =
      localStorage.getItem("noisebox-cart");

    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);

        if (Array.isArray(parsedCart)) {
          /*
           * Old Noisebox carts were created before
           * sellerId existed.
           *
           * Remove those old entries instead of
           * guessing which seller owns them.
           */
          const cleanedCart: CartItem[] =
            parsedCart
              .filter(
                (item) =>
                  Number.isInteger(
                    Number(item.productId),
                  ) &&
                  Number.isInteger(
                    Number(item.sellerId),
                  ),
              )
              .map((item) => ({
                productId: Number(
                  item.productId,
                ),

                sellerId: Number(
                  item.sellerId,
                ),

                productName:
                  item.productName ?? "",

                price: Number(item.price),

                image: item.image ?? "",

                quantity:
                  Number(item.quantity) > 0
                    ? Number(item.quantity)
                    : 1,
              }));

          setCartItems(cleanedCart);
        }
      } catch {
        localStorage.removeItem(
          "noisebox-cart",
        );
      }
    }

    setCartLoaded(true);
  }, []);

  /*
   * Save cart changes.
   */
  useEffect(() => {
    if (!cartLoaded) {
      return;
    }

    localStorage.setItem(
      "noisebox-cart",
      JSON.stringify(cartItems),
    );
  }, [cartItems, cartLoaded]);

  function addToCart(item: CartItem) {
    setCartItems((currentItems) => {
      const existingItem =
        currentItems.find(
          (cartItem) =>
            cartItem.productId ===
            item.productId,
        );

      if (existingItem) {
        return currentItems.map(
          (cartItem) =>
            cartItem.productId ===
            item.productId
              ? {
                  ...cartItem,

                  quantity:
                    cartItem.quantity +
                    item.quantity,
                }
              : cartItem,
        );
      }

      return [
        ...currentItems,
        {
          ...item,
          quantity:
            item.quantity > 0
              ? item.quantity
              : 1,
        },
      ];
    });
  }

  function removeFromCart(
    productId: number,
  ) {
    setCartItems((currentItems) =>
      currentItems.filter(
        (item) =>
          item.productId !== productId,
      ),
    );
  }

  function updateQuantity(
    productId: number,
    quantity: number,
  ) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity,
            }
          : item,
      ),
    );
  }

  const clearCart = useCallback(() => {
    setCartItems([]);

    localStorage.setItem(
      "noisebox-cart",
      JSON.stringify([]),
    );
  }, []);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartLoaded,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside CartProvider",
    );
  }

  return context;
}