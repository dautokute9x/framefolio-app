import { describe, expect, it } from "vitest";
import { makeStoragePathSegment, slugify } from "@/lib/utils";
import { normalizeSiteUrl } from "@/lib/url";

describe("slugify", () => {
  it.each([
    ["Đám cưới Minh & Lan", "dam-cuoi-minh-lan"],
    ["Kỷ yếu lớp 12A1", "ky-yeu-lop-12a1"],
    ["Ảnh cưới Đà Lạt", "anh-cuoi-da-lat"],
    ["  Alicia & Marcus  ", "alicia-marcus"],
    ["!!!", ""],
  ])("%s -> %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("makeStoragePathSegment", () => {
  it("keeps storage keys ASCII and free of path separators", () => {
    expect(makeStoragePathSegment("Ảnh cưới/../x y")).toBe("Anh-cuoi-..-x-y");
    expect(makeStoragePathSegment("đđđ")).toBe("ddd");
    expect(makeStoragePathSegment("")).toBe("photo");
  });
});

describe("normalizeSiteUrl", () => {
  it.each([
    ["framefolio-app.vercel.app", "https://framefolio-app.vercel.app"],
    ["https://framefolio-app.vercel.app/", "https://framefolio-app.vercel.app"],
    ["http://localhost:3000", "http://localhost:3000"],
    ["  https://example.com/some/path  ", "https://example.com"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeSiteUrl(input)).toBe(expected);
  });

  it.each([[""], [undefined], [null], ["not a url"], ["framefolio"]])("rejects %s", (input) => {
    expect(normalizeSiteUrl(input as string | undefined | null)).toBeNull();
  });
});
