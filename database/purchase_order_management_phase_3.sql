-- Purchase Order Management Phase 3
-- Snapshot the approval rule used by each purchase-order workflow.

DELIMITER $$

DROP PROCEDURE IF EXISTS pom_phase3_add_column_if_missing$$
CREATE PROCEDURE pom_phase3_add_column_if_missing(
    IN table_name_value VARCHAR(64),
    IN column_name_value VARCHAR(64),
    IN column_definition_value TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = table_name_value
          AND column_name = column_name_value
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', table_name_value, '` ADD COLUMN `', column_name_value, '` ', column_definition_value);
        PREPARE statement FROM @ddl;
        EXECUTE statement;
        DEALLOCATE PREPARE statement;
    END IF;
END$$

DROP PROCEDURE IF EXISTS pom_phase3_add_index_if_missing$$
CREATE PROCEDURE pom_phase3_add_index_if_missing(
    IN table_name_value VARCHAR(64),
    IN index_name_value VARCHAR(64),
    IN index_definition_value TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = table_name_value
          AND index_name = index_name_value
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', table_name_value, '` ADD ', index_definition_value);
        PREPARE statement FROM @ddl;
        EXECUTE statement;
        DEALLOCATE PREPARE statement;
    END IF;
END$$

DELIMITER ;

CALL pom_phase3_add_column_if_missing('purchase_order', 'approval_rule_id', 'INT NULL');
CALL pom_phase3_add_column_if_missing('purchase_order', 'approval_requires_finance', 'TINYINT(1) NULL');
CALL pom_phase3_add_column_if_missing('purchase_order', 'approval_allow_self_approval', 'TINYINT(1) NULL');
CALL pom_phase3_add_index_if_missing('purchase_order', 'idx_purchase_order_approval_rule', 'INDEX `idx_purchase_order_approval_rule` (`approval_rule_id`)');

DROP PROCEDURE IF EXISTS pom_phase3_add_index_if_missing;
DROP PROCEDURE IF EXISTS pom_phase3_add_column_if_missing;

-- Register purchase_order.approval_rule_id as an M2O relation to
-- purchase_order_approval_rules.rule_id in Directus after applying this migration.
