"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type CartItem = {
  productId: number;
  productName: string;
  price: number;
  image: string;
  size: string;
  quantity: number;
};

type CartContextType = {
  cartItems: CartItem[];
  cartLoaded: boolean;
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: number, size: string) => void;
  updateQuantity: (
    productId: number,
    size: string,
    quantity: number,
  ) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  useEffect(() => {
    const savedCart = localStorage.getItem("noisebox-cart");

    if (savedCart) {
      setCartItems(JSON.parse(savedCart));
    }

    setCartLoaded(true);
  }, []);

  useEffect(() => {
    if (cartLoaded) {
      localStorage.setItem("noisebox-cart", JSON.stringify(cartItems));
    }
  }, [cartItems, cartLoaded]);

  function addToCart(item: CartItem) {
    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (cartItem) =>
          cartItem.productId === item.productId &&
          cartItem.size === item.size,
      );

      if (existingItem) {
        return currentItems.map((cartItem) =>
          cartItem.productId === item.productId &&
          cartItem.size === item.size
            ? {
                ...cartItem,
                quantity: cartItem.quantity + item.quantity,
              }
            : cartItem,
        );
      }

      return [...currentItems, item];
    });
  }

  function removeFromCart(productId: number, size: string) {
    setCartItems((currentItems) =>
      currentItems.filter(
        (item) =>
          !(item.productId === productId && item.size === size),
      ),
    );
  }

  function updateQuantity(
    productId: number,
    size: string,
    quantity: number,
  ) {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.productId === productId && item.size === size
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
    localStorage.setItem("noisebox-cart", JSON.stringify([]));
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
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}