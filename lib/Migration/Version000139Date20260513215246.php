<?php

declare(strict_types=1);

namespace OCA\Freebusy\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\Migration\SimpleMigrationStep;
use OCP\Migration\IOutput;

class Version000139Date20260513215246 extends SimpleMigrationStep {

    public function changeSchema(
        IOutput $output,
        Closure $schemaClosure,
        array $options
    ): ?ISchemaWrapper {

        /** @var ISchemaWrapper $schema */
        $schema = $schemaClosure();

        if (!$schema->hasTable('availability_domains')) {

            $table = $schema->createTable(
                'availability_domains'
            );

            $table->addColumn(
                'id',
                'integer',
                [
                    'autoincrement' => true,
                    'notnull' => true,
                    'unsigned' => true
                ]
            );

            $table->addColumn(
                'domain',
                'string',
                [
                    'length' => 255,
                    'notnull' => true
                ]
            );

            $table->addColumn(
                'base_url',
                'string',
                [
                    'length' => 512,
                    'notnull' => true
                ]
            );

            $table->addColumn(
                'token',
                'string',
                [
                    'length' => 512,
                    'notnull' => true
                ]
            );

            $table->addColumn(
                'enabled',
                'smallint',
                [
                    'default' => 1,
		    'notnull' => true
                ]
            );

            $table->setPrimaryKey(['id']);

            $table->addUniqueIndex(
                ['domain'],
                'availability_domain_unique'
            );
        }

        return $schema;
    }
}
