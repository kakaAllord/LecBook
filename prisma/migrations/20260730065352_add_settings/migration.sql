-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionName" TEXT NOT NULL DEFAULT 'Your Institution Name',
    "updatedAt" DATETIME NOT NULL
);
