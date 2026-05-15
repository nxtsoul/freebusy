<?php

namespace OCA\Freebusy\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Attribute\AdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\IRequest;

class AdminController extends Controller {

    public function __construct(
        string $AppName,
        IRequest $request
    ) {
        parent::__construct($AppName, $request);
    }

    #[AdminRequired]
    #[NoCSRFRequired]
    public function index(): JSONResponse {

        $db = \OC::$server->getDatabaseConnection();

        $qb = $db->getQueryBuilder();

        $qb->select('*')
            ->from('availability_domains');

	$rows = [];

        $result = $qb->executeQuery();
	while ($row = $result->fetch()){
		$rows[] = $row;
	}

        return new JSONResponse($rows);
    }

    #[AdminRequired]
    #[NoCSRFRequired]
    public function create(
        $domain,
        $base_url,
        $token,
        $enabled = true
    ): JSONResponse {

        $db = \OC::$server->getDatabaseConnection();

        $qb = $db->getQueryBuilder();

        $qb->insert('availability_domains')
            ->values([
                'domain' => $qb->createNamedParameter($domain),
                'base_url' => $qb->createNamedParameter($base_url),
                'token' => $qb->createNamedParameter($token),
                'enabled' => $qb->createNamedParameter($enabled)
            ]);

        $qb->executeStatement();

        return new JSONResponse([
            'success' => true
        ]);
    }

    #[AdminRequired]
    #[NoCSRFRequired]
    public function update(
        $id,
        $domain,
        $base_url,
        $token,
        $enabled
    ): JSONResponse {

        $db = \OC::$server->getDatabaseConnection();

        $qb = $db->getQueryBuilder();

        $qb->update('availability_domains')
            ->set('domain', $qb->createNamedParameter($domain))
            ->set('base_url', $qb->createNamedParameter($base_url))
            ->set('token', $qb->createNamedParameter($token))
            ->set('enabled', $qb->createNamedParameter($enabled))
            ->where(
                $qb->expr()->eq(
                    'id',
                    $qb->createNamedParameter($id)
                )
            );

        $qb->executeStatement();

        return new JSONResponse([
            'success' => true
        ]);
    }

    #[AdminRequired]
    #[NoCSRFRequired]
    public function delete($id): JSONResponse {

        $db = \OC::$server->getDatabaseConnection();

        $qb = $db->getQueryBuilder();

        $qb->delete('availability_domains')
            ->where(
                $qb->expr()->eq(
                    'id',
                    $qb->createNamedParameter($id)
                )
            );

        $qb->executeStatement();

        return new JSONResponse([
            'success' => true
        ]);
    }
}
