-- CreateTable
CREATE TABLE "tree_progress" (
    "id" TEXT NOT NULL,
    "planting_id" TEXT NOT NULL,
    "noted_at" DATE NOT NULL,
    "photo_file_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tree_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queries" (
    "id" TEXT NOT NULL,
    "submission_id" VARCHAR(16) NOT NULL,
    "from_role" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_email" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_replies" (
    "id" TEXT NOT NULL,
    "query_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_email" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tree_progress_planting_id_idx" ON "tree_progress"("planting_id");

-- CreateIndex
CREATE INDEX "queries_submission_id_idx" ON "queries"("submission_id");

-- CreateIndex
CREATE INDEX "query_replies_query_id_idx" ON "query_replies"("query_id");

-- CreateIndex
CREATE INDEX "password_resets_email_idx" ON "password_resets"("email");

-- AddForeignKey
ALTER TABLE "tree_progress" ADD CONSTRAINT "tree_progress_planting_id_fkey" FOREIGN KEY ("planting_id") REFERENCES "tree_plantings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queries" ADD CONSTRAINT "queries_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_replies" ADD CONSTRAINT "query_replies_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
