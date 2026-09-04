// BLOB storage in the DB is the simplest thing that works for a
// self-hosted wiki, but it means the database grows with every upload —
// keep individual files bounded until/unless this moves to S3-compatible
// storage (see project.md).
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB
