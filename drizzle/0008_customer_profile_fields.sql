ALTER TABLE `customers`
  ADD COLUMN `age` int AFTER `longitude`,
  ADD COLUMN `gender` varchar(30) AFTER `age`,
  ADD COLUMN `socioeconomicLevel` varchar(50) AFTER `gender`,
  ADD COLUMN `interestHealthFitness` int NOT NULL DEFAULT 0 AFTER `socioeconomicLevel`,
  ADD COLUMN `interestNaturalFood` int NOT NULL DEFAULT 0 AFTER `interestHealthFitness`,
  ADD COLUMN `interestDigestiveIssues` int NOT NULL DEFAULT 0 AFTER `interestNaturalFood`,
  ADD COLUMN `lifestyleGym` int NOT NULL DEFAULT 0 AFTER `interestDigestiveIssues`,
  ADD COLUMN `lifestyleVegan` int NOT NULL DEFAULT 0 AFTER `lifestyleGym`,
  ADD COLUMN `lifestyleBiohacking` int NOT NULL DEFAULT 0 AFTER `lifestyleVegan`;
