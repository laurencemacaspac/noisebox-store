export type Product = {
  id: number;
  name: string;
  slug: string;
  description: string;
  category: string;
  price: number;
  image: string;
  featured?: boolean;
};