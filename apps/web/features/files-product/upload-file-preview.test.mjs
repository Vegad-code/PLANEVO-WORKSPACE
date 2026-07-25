import assert from "node:assert/strict"
import test from "node:test"
import {
  canCreateObjectPreview,
  formatUploadBytes,
  uploadPreviewKind,
  uploadTypeBadge,
} from "./upload-file-preview.ts"

const makeFile = (name, type = "", size = 1024) =>
  new File([new Uint8Array(size)], name, { type })

test("uploadPreviewKind routes by mime and extension", () => {
  assert.equal(uploadPreviewKind(makeFile("shot.png", "image/png")), "image")
  assert.equal(uploadPreviewKind(makeFile("clip.mp4", "video/mp4")), "video")
  assert.equal(uploadPreviewKind(makeFile("track.mp3", "audio/mpeg")), "audio")
  assert.equal(uploadPreviewKind(makeFile("brief.pdf", "application/pdf")), "pdf")
  assert.equal(uploadPreviewKind(makeFile("sheet.xlsx")), "spreadsheet")
  assert.equal(uploadPreviewKind(makeFile("notes.docx")), "document")
  assert.equal(uploadPreviewKind(makeFile("bundle.zip")), "archive")
  assert.equal(uploadPreviewKind(makeFile("model.c4d")), "generic")
})

test("uploadTypeBadge uses industry-standard short labels", () => {
  assert.equal(uploadTypeBadge(makeFile("a.pdf", "application/pdf")), "PDF")
  assert.equal(uploadTypeBadge(makeFile("b.xlsx")), "XLS")
  assert.equal(uploadTypeBadge(makeFile("c.csv", "text/csv")), "CSV")
  assert.equal(uploadTypeBadge(makeFile("d.docx")), "DOC")
  assert.equal(uploadTypeBadge(makeFile("e.zip")), "ZIP")
  assert.equal(uploadTypeBadge(makeFile("f.png", "image/png")), "PNG")
  assert.equal(uploadTypeBadge(makeFile("weird")), "FILE")
})

test("canCreateObjectPreview only for image and video", () => {
  assert.equal(canCreateObjectPreview("image"), true)
  assert.equal(canCreateObjectPreview("video"), true)
  assert.equal(canCreateObjectPreview("pdf"), false)
  assert.equal(canCreateObjectPreview("generic"), false)
})

test("formatUploadBytes formats progress labels", () => {
  assert.equal(formatUploadBytes(0), "0 B")
  assert.equal(formatUploadBytes(512), "512 B")
  assert.equal(formatUploadBytes(20 * 1024 * 1024), "20 MB")
})
