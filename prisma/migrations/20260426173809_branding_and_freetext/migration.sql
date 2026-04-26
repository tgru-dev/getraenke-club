-- CreateTable
CREATE TABLE "Branding" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "logoBytes" BLOB,
    "logoMime" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "freetext" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Category" ("color", "id", "key", "label", "sortOrder") SELECT "color", "id", "key", "label", "sortOrder" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE UNIQUE INDEX "Category_key_key" ON "Category"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
