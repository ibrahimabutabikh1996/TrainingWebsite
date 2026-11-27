import { PreviewProduct } from "../PreviewPages";

export default async function StorePreviewProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PreviewProduct slug={slug} />;
}
