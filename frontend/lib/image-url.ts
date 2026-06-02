export type DisplayImage = {
  thumbnail_url?: string | null;
  medium_url?: string | null;
  image_url?: string | null;
};

export function getDisplayImageUrl(image: DisplayImage | null | undefined): string | null {
  return image?.thumbnail_url || image?.medium_url || image?.image_url || null;
}

export function getPreviewImageUrl(image: DisplayImage | null | undefined): string | null {
  return image?.medium_url || image?.image_url || image?.thumbnail_url || null;
}
