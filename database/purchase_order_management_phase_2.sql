-- Purchase Order Management Phase 2
-- Preserve transaction-currency line values and tax rates used at submission.

DELIMITER $$

DROP PROCEDURE IF EXISTS pom_phase2_add_column_if_missing$$
CREATE PROCEDURE pom_phase2_add_column_if_missing(
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

DELIMITER ;

CALL pom_phase2_add_column_if_missing('purchase_order_products', 'unit_price_foreign', 'DECIMAL(15,4) NOT NULL DEFAULT 0.0000');
CALL pom_phase2_add_column_if_missing('purchase_order_products', 'gross_amount_foreign', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00');
CALL pom_phase2_add_column_if_missing('purchase_order_products', 'net_amount_foreign', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00');
CALL pom_phase2_add_column_if_missing('purchase_order_products', 'discount_percent', 'DECIMAL(7,4) NOT NULL DEFAULT 0.0000');
CALL pom_phase2_add_column_if_missing('purchase_order_products', 'vat_percent', 'DECIMAL(7,4) NOT NULL DEFAULT 0.0000');
CALL pom_phase2_add_column_if_missing('purchase_order_products', 'withholding_percent', 'DECIMAL(7,4) NOT NULL DEFAULT 0.0000');

DROP PROCEDURE IF EXISTS pom_phase2_add_column_if_missing;
