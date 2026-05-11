-- CreateTable
CREATE TABLE `ChineseSpellingProgress` (
    `id` VARCHAR(191) NOT NULL,
    `mode` VARCHAR(191) NOT NULL,
    `currentIndex` INTEGER NOT NULL,
    `totalItems` INTEGER NOT NULL,
    `completedCount` INTEGER NOT NULL,
    `lastPracticedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChineseSpellingProgress_mode_key`(`mode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
