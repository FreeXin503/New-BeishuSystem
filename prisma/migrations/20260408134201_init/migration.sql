-- CreateTable
CREATE TABLE `ChineseSpellingItem` (
    `id` VARCHAR(191) NOT NULL,
    `english` VARCHAR(191) NOT NULL,
    `chinese` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `tags` VARCHAR(191) NULL,
    `difficulty` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChineseSpellingFavorite` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `favoriteDate` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChineseSpellingFavorite_itemId_favoriteDate_key`(`itemId`, `favoriteDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChineseSpellingFavorite` ADD CONSTRAINT `ChineseSpellingFavorite_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `ChineseSpellingItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
