-- Purchase Order Management Phase 0
-- MySQL 8.x / Directus schema foundation. This script is idempotent.

DELIMITER $$

DROP PROCEDURE IF EXISTS pom_add_column_if_missing$$
CREATE PROCEDURE pom_add_column_if_missing(
    IN table_name_value VARCHAR(64),
    IN column_name_value VARCHAR(64),
    IN column_definition_value TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = table_name_value
          AND column_name = column_name_value
    ) THEN
        SET @ddl = CONCAT(
            'ALTER TABLE `', table_name_value, '` ADD COLUMN `',
            column_name_value, '` ', column_definition_value
        );
        PREPARE statement FROM @ddl;
        EXECUTE statement;
        DEALLOCATE PREPARE statement;
    END IF;
END$$

DROP PROCEDURE IF EXISTS pom_add_index_if_missing$$
CREATE PROCEDURE pom_add_index_if_missing(
    IN table_name_value VARCHAR(64),
    IN index_name_value VARCHAR(64),
    IN index_definition_value TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = table_name_value
          AND index_name = index_name_value
    ) THEN
        SET @ddl = CONCAT(
            'ALTER TABLE `', table_name_value, '` ADD ', index_definition_value
        );
        PREPARE statement FROM @ddl;
        EXECUTE statement;
        DEALLOCATE PREPARE statement;
    END IF;
END$$

DROP PROCEDURE IF EXISTS pom_add_fk_if_missing$$
CREATE PROCEDURE pom_add_fk_if_missing(
    IN table_name_value VARCHAR(64),
    IN constraint_name_value VARCHAR(64),
    IN constraint_definition_value TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = table_name_value
          AND constraint_name = constraint_name_value
          AND constraint_type = 'FOREIGN KEY'
    ) THEN
        SET @ddl = CONCAT(
            'ALTER TABLE `', table_name_value, '` ADD CONSTRAINT `',
            constraint_name_value, '` ', constraint_definition_value
        );
        PREPARE statement FROM @ddl;
        EXECUTE statement;
        DEALLOCATE PREPARE statement;
    END IF;
END$$

DROP PROCEDURE IF EXISTS pom_add_check_if_missing$$
CREATE PROCEDURE pom_add_check_if_missing(
    IN table_name_value VARCHAR(64),
    IN constraint_name_value VARCHAR(64),
    IN check_definition_value TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = table_name_value
          AND constraint_name = constraint_name_value
          AND constraint_type = 'CHECK'
    ) THEN
        SET @ddl = CONCAT(
            'ALTER TABLE `', table_name_value, '` ADD CONSTRAINT `',
            constraint_name_value, '` CHECK (', check_definition_value, ')'
        );
        PREPARE statement FROM @ddl;
        EXECUTE statement;
        DEALLOCATE PREPARE statement;
    END IF;
END$$

DELIMITER ;

CALL pom_add_column_if_missing('purchase_order', 'currency_code', 'VARCHAR(3) NOT NULL DEFAULT ''PHP''');
CALL pom_add_column_if_missing('purchase_order', 'exchange_rate', 'DECIMAL(18,6) NOT NULL DEFAULT 1.000000');
CALL pom_add_column_if_missing('purchase_order', 'total_foreign_currency', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00');
CALL pom_add_column_if_missing('purchase_order', 'is_import', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL pom_add_column_if_missing('purchase_order', 'workflow_revision', 'INT UNSIGNED NOT NULL DEFAULT 0');

UPDATE purchase_order
SET currency_code = 'PHP',
    exchange_rate = 1.000000,
    total_foreign_currency = COALESCE(total_amount, 0),
    is_import = 0
WHERE currency_code IS NULL
   OR currency_code = ''
   OR (currency_code = 'PHP' AND total_foreign_currency = 0);

CALL pom_add_column_if_missing(
    'purchase_order_products',
    'purchase_intent',
    'ENUM(''MRP_Demand'',''Buffer_Stock'') NOT NULL DEFAULT ''Buffer_Stock'''
);
CALL pom_add_column_if_missing('purchase_order_products', 'job_order_id', 'INT NULL');
CALL pom_add_index_if_missing(
    'purchase_order_products',
    'idx_po_products_job_order',
    'INDEX `idx_po_products_job_order` (`job_order_id`)'
);
CALL pom_add_fk_if_missing(
    'purchase_order_products',
    'fk_po_products_job_order',
    'FOREIGN KEY (`job_order_id`) REFERENCES `manufacturing_job_orders` (`job_order_id`) ON DELETE RESTRICT ON UPDATE CASCADE'
);
CALL pom_add_check_if_missing(
    'purchase_order_products',
    'chk_po_products_purchase_intent',
    '(`purchase_intent` = ''MRP_Demand'' AND `job_order_id` IS NOT NULL) OR (`purchase_intent` = ''Buffer_Stock'' AND `job_order_id` IS NULL)'
);

CREATE TABLE IF NOT EXISTS purchase_order_qa_parameters (
    parameter_id INT NOT NULL AUTO_INCREMENT,
    parameter_name VARCHAR(100) NOT NULL,
    data_type ENUM('Numeric', 'Boolean', 'Text') NOT NULL DEFAULT 'Numeric',
    unit_of_measure VARCHAR(20) NULL,
    description TEXT NULL,
    PRIMARY KEY (parameter_id),
    UNIQUE KEY uq_po_qa_parameter_name (parameter_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_qa_specs (
    spec_id INT NOT NULL AUTO_INCREMENT,
    product_id INT NOT NULL,
    parameter_id INT NOT NULL,
    target_min DECIMAL(12,4) NULL,
    target_max DECIMAL(12,4) NULL,
    expected_text VARCHAR(100) NULL,
    is_critical TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (spec_id),
    UNIQUE KEY uq_product_qa_parameter (product_id, parameter_id),
    KEY idx_product_qa_specs_parameter (parameter_id),
    CONSTRAINT fk_product_qa_specs_product
        FOREIGN KEY (product_id) REFERENCES products (product_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_qa_specs_parameter
        FOREIGN KEY (parameter_id) REFERENCES purchase_order_qa_parameters (parameter_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing tables may have been registered through Directus before this SQL was applied.
-- The SELECT exposes duplicate pairs before the unique-index statement fails.
SELECT product_id, parameter_id, COUNT(*) AS duplicate_count
FROM product_qa_specs
GROUP BY product_id, parameter_id
HAVING COUNT(*) > 1;

CALL pom_add_index_if_missing(
    'product_qa_specs',
    'uq_product_qa_parameter',
    'UNIQUE INDEX `uq_product_qa_parameter` (`product_id`, `parameter_id`)'
);

CREATE TABLE IF NOT EXISTS purchase_order_receiving_qa_results (
    result_id INT NOT NULL AUTO_INCREMENT,
    receiving_line_id INT NOT NULL,
    spec_id INT NOT NULL,
    actual_reading VARCHAR(100) NOT NULL,
    is_passed TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (result_id),
    UNIQUE KEY uq_receiving_qa_result (receiving_line_id, spec_id),
    KEY idx_receiving_qa_results_spec (spec_id),
    CONSTRAINT fk_receiving_qa_results_line
        FOREIGN KEY (receiving_line_id)
        REFERENCES purchase_order_receiving (purchase_order_product_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_receiving_qa_results_spec
        FOREIGN KEY (spec_id) REFERENCES product_qa_specs (spec_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_approval_rules (
    rule_id INT NOT NULL AUTO_INCREMENT,
    rule_name VARCHAR(150) NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    minimum_total_php DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    maximum_total_php DECIMAL(15,2) NULL,
    currency_code VARCHAR(3) NULL,
    import_scope ENUM('Any', 'Domestic', 'Import') NOT NULL DEFAULT 'Any',
    product_category_id INT NULL,
    requires_finance TINYINT(1) NOT NULL DEFAULT 1,
    allow_self_approval TINYINT(1) NOT NULL DEFAULT 1,
    effective_from DATE NULL,
    effective_to DATE NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (rule_id),
    UNIQUE KEY uq_po_approval_rule_name (rule_name),
    KEY idx_po_approval_rule_match (is_active, priority, minimum_total_php, maximum_total_php),
    KEY idx_po_approval_rule_category (product_category_id),
    CONSTRAINT fk_po_approval_rule_category
        FOREIGN KEY (product_category_id) REFERENCES categories (category_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_approval_history (
    history_id BIGINT NOT NULL AUTO_INCREMENT,
    purchase_order_id INT NOT NULL,
    action VARCHAR(40) NOT NULL,
    approval_stage ENUM('Plant', 'Finance', 'System') NOT NULL,
    actor_id INT NOT NULL,
    actor_role_id INT NULL,
    remarks TEXT NULL,
    from_inventory_status INT NULL,
    to_inventory_status INT NULL,
    revision_before INT UNSIGNED NOT NULL,
    revision_after INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (history_id),
    KEY idx_po_approval_history_order (purchase_order_id, created_at),
    KEY idx_po_approval_history_actor (actor_id),
    CONSTRAINT fk_po_approval_history_order
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_order (purchase_order_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_po_approval_history_actor
        FOREIGN KEY (actor_id) REFERENCES user (user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_po_approval_history_role
        FOREIGN KEY (actor_role_id) REFERENCES roles (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_approval_role_permissions (
    permission_id INT NOT NULL AUTO_INCREMENT,
    role_id INT NULL,
    user_id INT NULL,
    approval_stage ENUM('Plant', 'Finance') NOT NULL,
    can_reject TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (permission_id),
    UNIQUE KEY uq_po_approval_role_stage (role_id, approval_stage),
    UNIQUE KEY uq_po_approval_user_stage (user_id, approval_stage),
    CONSTRAINT fk_po_approval_role_permission
        FOREIGN KEY (role_id) REFERENCES roles (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_po_approval_user_permission
        FOREIGN KEY (user_id) REFERENCES user (user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_po_approval_permission_subject
        CHECK ((role_id IS NOT NULL AND user_id IS NULL) OR (role_id IS NULL AND user_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO purchase_order_approval_rules (
    rule_name,
    priority,
    minimum_total_php,
    maximum_total_php,
    currency_code,
    import_scope,
    product_category_id,
    requires_finance,
    allow_self_approval,
    is_active
)
SELECT
    'Fail-closed default',
    -1000,
    0.00,
    NULL,
    NULL,
    'Any',
    NULL,
    1,
    1,
    1
WHERE NOT EXISTS (
    SELECT 1
    FROM purchase_order_approval_rules
    WHERE rule_name = 'Fail-closed default'
);

CALL pom_add_column_if_missing('branches', 'bad_stock_branch_id', 'INT NULL');
CALL pom_add_index_if_missing(
    'branches',
    'idx_branches_bad_stock_branch',
    'INDEX `idx_branches_bad_stock_branch` (`bad_stock_branch_id`)'
);
CALL pom_add_fk_if_missing(
    'branches',
    'fk_branches_bad_stock_branch',
    'FOREIGN KEY (`bad_stock_branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE'
);

UPDATE branches SET bad_stock_branch_id = 182 WHERE id = 181 AND isBadStock = 0;
UPDATE branches SET bad_stock_branch_id = 184 WHERE id = 183 AND isBadStock = 0;
UPDATE branches SET bad_stock_branch_id = 186 WHERE id = 185 AND isBadStock = 0;

INSERT INTO inventory_transaction_types (type_name, direction, origin_table)
SELECT 'QA Reject / Bad Order Receipt', 'IN', 'purchase_order_receiving'
WHERE NOT EXISTS (
    SELECT 1
    FROM inventory_transaction_types
    WHERE type_name = 'QA Reject / Bad Order Receipt'
      AND direction = 'IN'
      AND origin_table = 'purchase_order_receiving'
);

DROP PROCEDURE IF EXISTS pom_add_fk_if_missing;
DROP PROCEDURE IF EXISTS pom_add_check_if_missing;
DROP PROCEDURE IF EXISTS pom_add_index_if_missing;
DROP PROCEDURE IF EXISTS pom_add_column_if_missing;

-- Phase 0 intentionally does not assign Urdaneta Branch (163) a bad-stock branch.
-- Rejected receiving must remain blocked there until an explicit mapping is configured.
