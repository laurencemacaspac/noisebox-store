"use client";

import { useState } from "react";

/* ============================================================
 * MUSICBRAINZ / COVER ART ARCHIVE
 * ============================================================ */

type ImportSummary = {
  approvedMatches: number;
  productsProcessed: number;
  productsWithArtwork: number;
  productsWithoutArtwork: number;
  imagesInserted: number;
  imagesAlreadyExist: number;
  errors: number;
};

type ImportResponse = {
  success: boolean;

  batch?: {
    start: number;
    limit: number;
    scanned: number;
    nextStart: number | null;
  };

  summary?: ImportSummary;

  error?: string;
};

type Totals = {
  scanned: number;
  approved: number;
  productsWithArtwork: number;
  productsWithoutArtwork: number;
  imagesInserted: number;
  imagesAlreadyExist: number;
  errors: number;
};

/* ============================================================
 * DISCOGS DEVELOPMENT ARTWORK
 * ============================================================ */

type DiscogsSummary = {
  imagesInserted: number;
  alreadyHasArtwork: number;
  noDiscogsId: number;
  noDiscogsArtwork: number;
  errors: number;
};

type DiscogsResponse = {
  success: boolean;

  batch?: {
    start: number;
    limit: number;
    scanned: number;
    nextStart: number | null;
  };

  summary?: DiscogsSummary;

  error?: string;
};

type DiscogsTotals = {
  scanned: number;
  imagesInserted: number;
  alreadyHasArtwork: number;
  noDiscogsId: number;
  noDiscogsArtwork: number;
  errors: number;
};

const BATCH_SIZE = 10;
const DISCOGS_BATCH_SIZE = 5;

export default function ArtworkAdminPage() {
  /* ==========================================================
   * MUSICBRAINZ STATE
   * ========================================================== */

  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const [currentStart, setCurrentStart] =
    useState<number | null>(null);

  const [message, setMessage] = useState(
    "Ready to import artwork.",
  );

  const [totals, setTotals] = useState<Totals>({
    scanned: 0,
    approved: 0,
    productsWithArtwork: 0,
    productsWithoutArtwork: 0,
    imagesInserted: 0,
    imagesAlreadyExist: 0,
    errors: 0,
  });

  /* ==========================================================
   * DISCOGS STATE
   * ========================================================== */

  const [discogsRunning, setDiscogsRunning] =
    useState(false);

  const [discogsFinished, setDiscogsFinished] =
    useState(false);

  const [discogsCurrentStart, setDiscogsCurrentStart] =
    useState<number | null>(null);

  const [discogsMessage, setDiscogsMessage] = useState(
    "Ready to fill missing artwork.",
  );

  const [discogsTotals, setDiscogsTotals] =
    useState<DiscogsTotals>({
      scanned: 0,
      imagesInserted: 0,
      alreadyHasArtwork: 0,
      noDiscogsId: 0,
      noDiscogsArtwork: 0,
      errors: 0,
    });

  /* ==========================================================
   * MUSICBRAINZ IMPORT
   * ========================================================== */

  async function startImport() {
    if (running || discogsRunning) {
      return;
    }

    setRunning(true);
    setFinished(false);

    setTotals({
      scanned: 0,
      approved: 0,
      productsWithArtwork: 0,
      productsWithoutArtwork: 0,
      imagesInserted: 0,
      imagesAlreadyExist: 0,
      errors: 0,
    });

    setMessage("Starting artwork import...");

    let start = 2;

    try {
      while (true) {
        setCurrentStart(start);

        setMessage(
          `Processing products starting at ID ${start}...`,
        );

        const response = await fetch(
          `/api/artwork/import?start=${start}&limit=${BATCH_SIZE}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data =
          (await response.json()) as ImportResponse;

        if (!response.ok) {
          throw new Error(
            data.error ??
              `Import failed with status ${response.status}`,
          );
        }

        if (!data.batch || !data.summary) {
          throw new Error(
            "Importer returned an unexpected response.",
          );
        }

        const batch = data.batch;
        const summary = data.summary;

        setTotals((current) => ({
          scanned:
            current.scanned + batch.scanned,

          approved:
            current.approved +
            summary.approvedMatches,

          productsWithArtwork:
            current.productsWithArtwork +
            summary.productsWithArtwork,

          productsWithoutArtwork:
            current.productsWithoutArtwork +
            summary.productsWithoutArtwork,

          imagesInserted:
            current.imagesInserted +
            summary.imagesInserted,

          imagesAlreadyExist:
            current.imagesAlreadyExist +
            summary.imagesAlreadyExist,

          errors:
            current.errors + summary.errors,
        }));

        if (batch.scanned < BATCH_SIZE) {
          setFinished(true);
          setMessage("Artwork import finished.");
          break;
        }

        if (!batch.nextStart) {
          setFinished(true);
          setMessage("Artwork import finished.");
          break;
        }

        if (batch.nextStart <= start) {
          throw new Error(
            "Importer returned an invalid nextStart value.",
          );
        }

        start = batch.nextStart;

        await new Promise((resolve) =>
          setTimeout(resolve, 1500),
        );
      }
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Artwork import failed.",
      );
    } finally {
      setRunning(false);
      setCurrentStart(null);
    }
  }

  /* ==========================================================
   * DISCOGS DEV IMPORT
   * ========================================================== */

  async function startDiscogsImport() {
    if (running || discogsRunning) {
      return;
    }

    setDiscogsRunning(true);
    setDiscogsFinished(false);

    setDiscogsTotals({
      scanned: 0,
      imagesInserted: 0,
      alreadyHasArtwork: 0,
      noDiscogsId: 0,
      noDiscogsArtwork: 0,
      errors: 0,
    });

    setDiscogsMessage(
      "Starting Discogs development artwork import...",
    );

    /*
     * Start from release 1.
     *
     * Releases that already have artwork are automatically
     * skipped by the server endpoint.
     */
    let start = 1;

    try {
      while (true) {
        setDiscogsCurrentStart(start);

        setDiscogsMessage(
          `Checking releases starting at ID ${start}...`,
        );

        const response = await fetch(
          `/api/artwork/discogs-dev?start=${start}&limit=${DISCOGS_BATCH_SIZE}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data =
          (await response.json()) as DiscogsResponse;

        /*
         * The endpoint may return success=false if one release
         * in the batch had an error, while still returning useful
         * batch/summary information.
         *
         * Only throw immediately when the HTTP request itself
         * failed or the expected batch information is missing.
         */
        if (!response.ok) {
          throw new Error(
            data.error ??
              `Discogs import failed with status ${response.status}`,
          );
        }

        if (!data.batch || !data.summary) {
          throw new Error(
            data.error ??
              "Discogs importer returned an unexpected response.",
          );
        }

        const batch = data.batch;
        const summary = data.summary;

        setDiscogsTotals((current) => ({
          scanned:
            current.scanned + batch.scanned,

          imagesInserted:
            current.imagesInserted +
            summary.imagesInserted,

          alreadyHasArtwork:
            current.alreadyHasArtwork +
            summary.alreadyHasArtwork,

          noDiscogsId:
            current.noDiscogsId +
            summary.noDiscogsId,

          noDiscogsArtwork:
            current.noDiscogsArtwork +
            summary.noDiscogsArtwork,

          errors:
            current.errors +
            summary.errors,
        }));

        /*
         * Fewer records than requested means we've reached
         * the end of the releases table.
         */
        if (batch.scanned < DISCOGS_BATCH_SIZE) {
          setDiscogsFinished(true);

          setDiscogsMessage(
            "Discogs development artwork import finished.",
          );

          break;
        }

        if (!batch.nextStart) {
          setDiscogsFinished(true);

          setDiscogsMessage(
            "Discogs development artwork import finished.",
          );

          break;
        }

        /*
         * Protect against an accidental infinite loop.
         */
        if (batch.nextStart <= start) {
          throw new Error(
            "Discogs importer returned an invalid nextStart value.",
          );
        }

        start = batch.nextStart;

        /*
         * Give the external API a short pause between batches.
         */
        await new Promise((resolve) =>
          setTimeout(resolve, 1500),
        );
      }
    } catch (error) {
      console.error(error);

      setDiscogsMessage(
        error instanceof Error
          ? error.message
          : "Discogs development artwork import failed.",
      );
    } finally {
      setDiscogsRunning(false);
      setDiscogsCurrentStart(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {/* ======================================================
       * HEADER
       * ====================================================== */}

      <div className="mb-10">
        <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
          Noisebox Admin
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          Artwork Importer
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-gray-600">
          Manage shared release artwork used throughout the
          Noisebox marketplace.
        </p>
      </div>

      {/* ======================================================
       * MUSICBRAINZ
       * ====================================================== */}

      <div className="border border-gray-200 bg-white p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Permanent Artwork
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            MusicBrainz / Cover Art Archive
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            Match inventory against MusicBrainz and import
            verified Cover Art Archive images.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={running || discogsRunning}
            onClick={startImport}
            className="bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {running
              ? "Importing..."
              : "Import Artwork"}
          </button>

          {running && (
            <span className="text-sm text-gray-500">
              Please keep this page open.
            </span>
          )}
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6">
          <p className="font-medium">
            {message}
          </p>

          {currentStart !== null && (
            <p className="mt-2 text-sm text-gray-500">
              Current starting product ID:{" "}
              {currentStart}
            </p>
          )}

          {finished && (
            <p className="mt-2 text-sm font-medium">
              Complete ✓
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Products Scanned"
            value={totals.scanned}
          />

          <Stat
            label="Approved Matches"
            value={totals.approved}
          />

          <Stat
            label="Products With Artwork"
            value={totals.productsWithArtwork}
          />

          <Stat
            label="No Artwork Available"
            value={totals.productsWithoutArtwork}
          />

          <Stat
            label="Images Added"
            value={totals.imagesInserted}
          />

          <Stat
            label="Already Imported"
            value={totals.imagesAlreadyExist}
          />

          <Stat
            label="Errors"
            value={totals.errors}
          />
        </div>
      </div>

      {/* ======================================================
       * DISCOGS DEV MODE
       * ====================================================== */}

      <div className="mt-10 border-2 border-dashed border-gray-300 bg-gray-50 p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Private Development Only
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Discogs Missing Artwork
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            Fill releases that currently have no shared artwork
            using their exact Discogs release ID. These images
            are temporary development data and are tagged
            separately from permanent Noisebox artwork.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={discogsRunning || running}
            onClick={startDiscogsImport}
            className="bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {discogsRunning
              ? "Filling Artwork..."
              : "Fill Missing Artwork"}
          </button>

          {discogsRunning && (
            <span className="text-sm text-gray-500">
              Please keep this page open.
            </span>
          )}
        </div>

        <div className="mt-8 border-t border-gray-300 pt-6">
          <p className="font-medium">
            {discogsMessage}
          </p>

          {discogsCurrentStart !== null && (
            <p className="mt-2 text-sm text-gray-500">
              Current starting release ID:{" "}
              {discogsCurrentStart}
            </p>
          )}

          {discogsFinished && (
            <p className="mt-2 text-sm font-medium">
              Complete ✓
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Releases Scanned"
            value={discogsTotals.scanned}
          />

          <Stat
            label="Discogs Images Added"
            value={discogsTotals.imagesInserted}
          />

          <Stat
            label="Already Had Artwork"
            value={discogsTotals.alreadyHasArtwork}
          />

          <Stat
            label="No Discogs ID"
            value={discogsTotals.noDiscogsId}
          />

          <Stat
            label="No Discogs Artwork"
            value={discogsTotals.noDiscogsArtwork}
          />

          <Stat
            label="Errors"
            value={discogsTotals.errors}
          />
        </div>

        <div className="mt-8 border border-gray-300 bg-white p-5">
          <p className="text-sm font-medium">
            Development artwork marker
          </p>

          <code className="mt-2 block text-sm text-gray-600">
            image_source = discogs_dev_only
          </code>

          <p className="mt-3 text-xs leading-5 text-gray-500">
            Discogs development artwork can therefore be
            identified and removed separately without deleting
            Cover Art Archive or community artwork.
          </p>
        </div>
      </div>

      {/* ======================================================
       * RULES
       * ====================================================== */}

      <div className="mt-8 border border-gray-200 bg-gray-50 p-6">
        <h2 className="font-semibold">
          Import rules
        </h2>

        <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-600">
          <li>
            • Existing shared artwork is never replaced by
            Discogs development artwork.
          </li>

          <li>
            • Discogs development artwork uses exact release
            IDs rather than fuzzy matching.
          </li>

          <li>
            • All Discogs development images are tagged
            discogs_dev_only.
          </li>

          <li>
            • Cover Art Archive and community artwork remain
            separate from development artwork.
          </li>

          <li>
            • Only one artwork importer can run at a time.
          </li>
        </ul>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="border border-gray-200 bg-white p-5">
      <p className="text-3xl font-bold">
        {value}
      </p>

      <p className="mt-1 text-sm text-gray-500">
        {label}
      </p>
    </div>
  );
}