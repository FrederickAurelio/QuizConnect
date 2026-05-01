import { Types } from "mongoose";
import AiPreparedMaterial from "../../models/AiPreparedMaterial.js";

/** Total `cleanTexts.length` across selected prepared materials must not exceed this. */
export const MAX_PREPARED_CHUNKS_PER_GENERATION = 40;

export function preparedChunkBudgetExceededMessage(chunkTotal: number): string {
  return (
    `Your prepared material is too large for one generation (${chunkTotal} text segments; ` +
    `maximum ${MAX_PREPARED_CHUNKS_PER_GENERATION}). Remove a file or use a shorter excerpt.`
  );
}

/**
 * Loads READY prepared docs for the user, preserves client request order, sums chunk counts.
 */
export async function sumPreparedChunksForGeneration(params: {
  userObjectId: Types.ObjectId;
  preparedObjectIds: Types.ObjectId[];
}): Promise<
  | { ok: true; chunkTotal: number }
  | { ok: false; message: string }
> {
  const { userObjectId, preparedObjectIds } = params;

  const docs = await AiPreparedMaterial.find({
    _id: { $in: preparedObjectIds },
    userId: userObjectId,
    status: "READY",
  })
    .select({ cleanTexts: 1 })
    .lean();

  if (docs.length !== preparedObjectIds.length) {
    return {
      ok: false,
      message:
        "One or more prepared files are missing, expired, or do not belong to you.",
    };
  }

  const orderMap = new Map(
    preparedObjectIds.map((id, idx) => [String(id), idx] as const),
  );
  docs.sort(
    (a, b) =>
      (orderMap.get(String(a._id)) ?? 0) - (orderMap.get(String(b._id)) ?? 0),
  );

  let chunkTotal = 0;
  for (const d of docs) {
    chunkTotal += (d.cleanTexts as string[]).length;
  }

  if (chunkTotal > MAX_PREPARED_CHUNKS_PER_GENERATION) {
    return {
      ok: false,
      message: preparedChunkBudgetExceededMessage(chunkTotal),
    };
  }

  return { ok: true, chunkTotal };
}
