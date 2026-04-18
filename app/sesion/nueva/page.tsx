import { redirect } from "next/navigation";

export default async function LegacyNuevaSesionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();

  const cc = resolvedSearchParams.cc;
  const error = resolvedSearchParams.error;

  if (typeof cc === "string" && cc.trim()) {
    params.set("cc", cc.trim());
  }

  if (typeof error === "string" && error.trim()) {
    params.set("error", error.trim());
  }

  const query = params.toString();
  redirect(query ? `/nueva-sesion?${query}` : "/nueva-sesion");
}
