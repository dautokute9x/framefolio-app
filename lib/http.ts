// Parses a JSON request body, returning null instead of throwing on bad input.
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
