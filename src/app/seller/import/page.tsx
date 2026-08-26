"use client";

import { ChangeEvent, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";

type DiscogsRow = {
  listing_id: string;
  artist: string;
  title: string;
  label: string;
  catno: string;
  format: string;
  release_id: string;
  status: string;
  price: string;
  created: string;
  updated: string;
  comments: string;
  media_condition: string;
  sleeve_condition: string;
  accept_offer: string;
  external_id: string;
  weight: string;
  format_quantity: string;
  location: string;
  quantity: string;
};

export default function DiscogsImportPage() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<DiscogsRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setErrorMessage("");
    setSuccessMessage("");
    setRows([]);
    setFileName(file.name);
    setImportProgress(0);

    Papa.parse<DiscogsRow>(file, {
      header: true,
      skipEmptyLines: true,

      complete: (results) => {
        if (results.errors.length > 0) {
          setErrorMessage("There was a problem reading this CSV file.");
          return;
        }

        const parsedRows = results.data;

        if (
          parsedRows.length === 0 ||
          !("listing_id" in parsedRows[0]) ||
          !("release_id" in parsedRows[0])
        ) {
          setErrorMessage(
            "This does not appear to be a supported Discogs inventory CSV.",
          );
          return;
        }

        setRows(parsedRows);
      },

      error: () => {
        setErrorMessage("Unable to read the selected CSV file.");
      },
    });
  }

  const forSaleRows = rows.filter(
    (row) => row.status?.toUpperCase() === "FOR_SALE",
  );

  const soldRows = rows.filter(
    (row) => row.status?.toUpperCase() === "SOLD",
  );

  const draftRows = rows.filter(
    (row) => row.status?.toUpperCase() === "DRAFT",
  );

  async function handleImport() {
    if (forSaleRows.length === 0) return;

    setImporting(true);
    setErrorMessage("");
    setSuccessMessage("");
    setImportProgress(0);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be signed in to import inventory.");
      }

      const { data: seller, error: sellerError } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (sellerError || !seller) {
        throw new Error(
          "Seller account not found. Create your shop before importing inventory.",
        );
      }

      const products = forSaleRows.map((row) => ({
        seller_id: seller.id,

        artist: row.artist?.trim() || null,
        title: row.title?.trim() || "Untitled",
        description: row.comments?.trim() || null,

        price: Number.parseFloat(row.price) || 0,
        quantity: Number.parseInt(row.quantity, 10) || 1,
        status: "for_sale",

        label: row.label?.trim() || null,
        catalog_number: row.catno?.trim() || null,
        format: row.format?.trim() || null,
        format_quantity:
          Number.parseInt(row.format_quantity, 10) || null,

        media_condition: row.media_condition?.trim() || null,
        sleeve_condition: row.sleeve_condition?.trim() || null,
        comments: row.comments?.trim() || null,

        source: "discogs",
        source_listing_id: row.listing_id?.trim() || null,
        source_release_id: row.release_id?.trim() || null,
        external_id: row.external_id?.trim() || null,

        accept_offer:
          row.accept_offer?.toLowerCase() === "true" ||
          row.accept_offer === "1",

        weight: row.weight
          ? Number.parseFloat(row.weight) || null
          : null,

        primary_image_url: null,
        image_source: null,
      }));

      const batchSize = 50;
      let processed = 0;

      for (let index = 0; index < products.length; index += batchSize) {
        const batch = products.slice(index, index + batchSize);

        const { error } = await supabase
          .from("products")
          .upsert(batch, {
            onConflict: "seller_id,source,source_listing_id",
          });

        if (error) {
          throw error;
        }

        processed += batch.length;

        setImportProgress(
          Math.round((processed / products.length) * 100),
        );
      }

      setSuccessMessage(
        `${products.length} Discogs products imported successfully.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to import inventory.";

      setErrorMessage(message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <Link
        href="/seller"
        className="text-sm text-gray-500 hover:text-black"
      >
        ← Seller Dashboard
      </Link>

      <div className="mt-8">
        <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
          Inventory Import
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Import from Discogs
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-gray-600">
          Upload a Discogs inventory CSV to quickly create your
          Noisebox listings. Only active FOR_SALE listings will be
          imported.
        </p>
      </div>

      <div className="mt-10 border border-gray-200 p-8">
        <label
          htmlFor="discogs-file"
          className="block text-sm font-medium"
        >
          Discogs Inventory CSV
        </label>

        <input
          id="discogs-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          disabled={importing}
          className="mt-4 block w-full text-sm"
        />

        {fileName && (
          <p className="mt-3 text-sm text-gray-500">
            Selected: {fileName}
          </p>
        )}

        {errorMessage && (
          <div className="mt-6 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 bg-green-50 p-4 text-sm text-green-700">
            {successMessage}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Total Listings</p>
              <p className="mt-2 text-3xl font-bold">{rows.length}</p>
            </div>

            <div className="border border-gray-200 p-5">
              <p className="text-sm text-gray-500">For Sale</p>
              <p className="mt-2 text-3xl font-bold">
                {forSaleRows.length}
              </p>
            </div>

            <div className="border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Sold</p>
              <p className="mt-2 text-3xl font-bold">
                {soldRows.length}
              </p>
            </div>

            <div className="border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Draft</p>
              <p className="mt-2 text-3xl font-bold">
                {draftRows.length}
              </p>
            </div>
          </div>

          <div className="mt-10 overflow-hidden border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
              <div>
                <h2 className="font-semibold">Import Preview</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Showing active FOR_SALE listings
                </p>
              </div>

              <span className="text-sm text-gray-500">
                {forSaleRows.length} products
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3">Artist</th>
                    <th className="px-5 py-3">Title</th>
                    <th className="px-5 py-3">Format</th>
                    <th className="px-5 py-3">Condition</th>
                    <th className="px-5 py-3">Price</th>
                  </tr>
                </thead>

                <tbody>
                  {forSaleRows.slice(0, 20).map((row) => (
                    <tr
                      key={row.listing_id}
                      className="border-b border-gray-100"
                    >
                      <td className="px-5 py-4">{row.artist}</td>

                      <td className="px-5 py-4 font-medium">
                        {row.title}
                      </td>

                      <td className="px-5 py-4">{row.format}</td>

                      <td className="px-5 py-4">
                        {row.media_condition}
                      </td>

                      <td className="px-5 py-4">${row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {forSaleRows.length > 20 && (
              <div className="border-t border-gray-200 px-6 py-4 text-sm text-gray-500">
                Showing the first 20 of {forSaleRows.length} active
                listings.
              </div>
            )}
          </div>

          {importing && (
            <div className="mt-8">
              <div className="mb-2 flex justify-between text-sm">
                <span>Importing inventory...</span>
                <span>{importProgress}%</span>
              </div>

              <div className="h-2 overflow-hidden bg-gray-200">
                <div
                  className="h-full bg-black transition-all"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || forSaleRows.length === 0}
              className="bg-black px-6 py-3 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {importing
                ? `Importing... ${importProgress}%`
                : `Import ${forSaleRows.length} Products`}
            </button>
          </div>
        </>
      )}
    </main>
  );
}