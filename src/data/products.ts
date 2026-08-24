import type { Product } from "@/types/Product";

export const products: Product[] = [
  {
    id: 1,
    name: "Graphic T-Shirt",
    slug: "graphic-t-shirt",
    description: "A limited-run graphic t-shirt.",
    category: "Apparel",
    price: 28,
    image: "/products/adorable-shirt-etsy.png",
    featured: true,
  },
  {
    id: 2,
    name: "Limited Edition Poster",
    slug: "limited-edition-poster",
    description: "A music-inspired limited edition poster.",
    category: "Posters",
    price: 24,
    image: "/products/ChatGPT Image Aug 9, 2026 at 04_52_34 PM.png",
    featured: true,
  },
  {
    id: 3,
    name: "Canvas Tote Bag",
    slug: "canvas-tote-bag",
    description: "A simple canvas tote bag.",
    category: "Accessories",
    price: 18,
    image: "/products/canvas-tote-bag.jpg",
    featured: true,
  },
  {
    id: 4,
    name: "Baseball Shirt",
    slug: "baseball-shirt",
    description: "A classic baseball-style shirt.",
    category: "Apparel",
    price: 32,
    image: "/products/baseball-shirt.jpg",
    featured: true,
  },
];
