-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "vat_frequency" TEXT NOT NULL,
    "assigned_employee_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_categories" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "task_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "assigned_employee_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "period_start" DATE,
    "due_date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_requirements" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "document_type" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "received_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_categories_code_key" ON "task_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "task_categories_name_key" ON "task_categories"("name");

-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_client_id_idx" ON "tasks"("client_id");

-- CreateIndex
CREATE INDEX "tasks_assigned_employee_id_idx" ON "tasks"("assigned_employee_id");

-- CreateIndex
CREATE INDEX "tasks_category_id_idx" ON "tasks"("category_id");

-- CreateIndex
CREATE INDEX "document_requirements_due_date_idx" ON "document_requirements"("due_date");

-- CreateIndex
CREATE INDEX "document_requirements_status_idx" ON "document_requirements"("status");

-- CreateIndex
CREATE INDEX "document_requirements_client_id_idx" ON "document_requirements"("client_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "task_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
