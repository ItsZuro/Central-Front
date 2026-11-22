

export interface CategoryResponse {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}