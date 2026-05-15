<?php

namespace OCA\Freebusy\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\PublicPage;
use OCP\AppFramework\Http\DataDisplayResponse;
use OCP\IRequest;
use OCA\DAV\CalDAV\CalDavBackend;
use Psr\Log\LoggerInterface;

class FreebusyController extends Controller {

    private $calDavBackend;
    private $logger;

    public function __construct($AppName, IRequest $request, CalDavBackend $calDavBackend, LoggerInterface $logger) {
        parent::__construct($AppName, $request);
		$this->calDavBackend = $calDavBackend;
		$this->logger = $logger;
    }

    private function normalizeDate($dateString) {

		try {
			if (str_ends_with($dateString, 'Z')) {
				return gmdate('Y-m-d\TH:i:s\Z', strtotime($dateString));
			}

			// caso sem timezone, assume local (Nextcloud geralmente usa TZID)
			return gmdate('Y-m-d\TH:i:s\Z', strtotime($dateString));

		} catch (\Exception $e) {
			return null;
		}
    }

	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[PublicPage]
	public function avatar($email) {

		$userManager = \OC::$server->getUserManager();

		$type = $this->resolveUserType($email, $userManager);

		// 🔥 LOCAL
		if ($type === 'local') {

			$user = null;

			$found = $userManager->getByEmail($email);

			if (!empty($found)) {
				$user = $found[0];
			}

			if (!$user) {
				return new DataDisplayResponse('', 404);
			}

			$uid = $user->getUID();

			$url =
				\OC::$server->getRequest()->getServerProtocol() .
				'://' .
				\OC::$server->getRequest()->getServerHost() .
				'/index.php/avatar/' .
				rawurlencode($uid) .
				'/32';

		} else {

			list(, $domain) = explode('@', strtolower($email));

			$config = $this->getDomainConfig($domain);

			if (!$config) {
				return new DataDisplayResponse('', 404);
			}

			$remoteData = $this->fetchRemoteFreeBusy(
				$email,
				date('c'),
				date('c')
			);

			$remoteUid = $remoteData['uid'] ?? null;

			if (!$remoteUid) {
				return new DataDisplayResponse('', 404);
			}

			$url =
				rtrim($config['base_url'], '/') .
				'/index.php/avatar/' .
				rawurlencode($remoteUid) .
				'/32';
		}

		try {

			$client = \OC::$server
				->get(\OCP\Http\Client\IClientService::class)
				->newClient();

			$response = $client->get($url);

			return new DataDisplayResponse(
				$response->getBody(),
				200,
				[
					'Content-Type' => $response->getHeader('Content-Type'),
					'Cache-Control' => 'max-age=3600'
				]
			);

		} catch (\Exception $e) {

			return new DataDisplayResponse('', 404);
		}
	}

    private function fetchRemoteFreeBusy($input, $start, $end) {

    	list($uid, $domain) = explode('@', $input);

    	$config = $this->getDomainConfig($domain);

    	if (!$config) {
            return [];
    	}

        $client = \OC::$server->get(\OCP\Http\Client\IClientService::class)->newClient();

		try {
			$response = $client->get(
				$config['base_url'] . '/index.php/apps/freebusy/freebusy',
				[
					'headers' => [
						'Authorization' => 'Bearer ' . $config['token']
					],
					'query' => [
						'users' => $input,
						'start' => $start,
						'end' => $end
					],
					'timeout' => 1.2
				]
			);

			$data = json_decode($response->getBody(), true);
			return $data[$input] ?? [
				'uid' => null,
				'name' => $input,
				'email' => $input,
				'events' => []
			];

		} catch (\Exception $e) {
			$this->logger->error("Failed to make a freebusy request on: " . $config['base_url'] . " Error: " . $e);
			return [];
		}
	}

    private function resolveUserType($input, $userManager) {

    	$input = strtolower(trim($input));

    	// UID direto
    	if (!str_contains($input, '@')) {
            	return $userManager->get($input) ? 'local' : 'unknown';
    	}

    	// email local
		$found = $userManager->getByEmail($input);

    	if (!empty($found)) {
        	return 'local';
    	}

    	return 'remote';
    }

    private function getDomainConfig($domain) {
		$db = \OC::$server->getDatabaseConnection();
		$qb = $db->getQueryBuilder();

		$qb->select('*')
			->from('availability_domains')
			->where(
				$qb->expr()->eq(
					'domain',
					$qb->createNamedParameter($domain)
				)
			)
			->andWhere(
				$qb->expr()->eq(
					'enabled',
					$qb->createNamedParameter(1)
				)
			);

		$result = $qb->executeQuery()->fetch();

		return $result ?: null;
    }

	private function getAvatarUrl($uid, $email = null) {

		$request = \OC::$server->getRequest();

		if ($email && str_contains($email, '@')) {

			list(, $domain) = explode('@', strtolower($email));

			$config = $this->getDomainConfig($domain);

			if ($config) {

				return $request->getServerProtocol() .
					'://' .
					$request->getServerHost() .
					'/index.php/apps/freebusy/avatar?email=' .
					rawurlencode($email);
			}
		}

		$baseUrl = $request->getServerProtocol() . '://' . $request->getServerHost();

		return $baseUrl .
			'/index.php/avatar/' .
			rawurlencode($uid) .
			'/32';
	}

    private function isValidToken($authHeader) {

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return false;
        }

        $token = str_replace('Bearer ', '', $authHeader);

        $qb = \OC::$server->getDatabaseConnection()->getQueryBuilder();

        $qb->select('id')
           ->from('availability_domains')
           ->where($qb->expr()->eq('token', $qb->createNamedParameter($token)))
           ->andWhere($qb->expr()->eq('enabled', $qb->createNamedParameter(1)));

        $result = $qb->executeQuery()->fetch();

    	return $result !== false;
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    #[PublicPage]
    public function getFreeBusy($users, $start, $end) {
		
	    $request = \OC::$server->getRequest();
		$userSession = \OC::$server->getUserSession();
        $auth = $request->getHeader('Authorization');
		
		// se tem sessão válida, permite
		if ($userSession->isLoggedIn()) {
		    // OK, segue
		} elseif ($this->isValidToken($auth)) {
		    // OK, federado
		} else {
		     return new JSONResponse(['error' => 'Unauthorized'], 401);
		}
		
		if (is_string($users)) {
    		$users = explode(',', $users);
		} elseif (empty($users)) {
		    return new JSONResponse([]);
		}

		$userManager = \OC::$server->getUserManager();
		$resolvedUsers = [];
    	$result = [];
		$inputMap = [];

    	// CONVERTE EMAIL P/ UID
		foreach ($users as $input) {
			$input = strtolower(trim($input));

			$type = $this->resolveUserType($input, $userManager);

    		// USUÁRIO FEDERADO
			if ($type === 'remote') {
				$result[$input] = $this->fetchRemoteFreeBusy($input, $start, $end);
				continue;
			}

			$uid = null;

			if (str_contains($input, '@')) {
				$foundUsers = $userManager->getByEmail($input);
				if (!empty($foundUsers)) {
					$uid = $foundUsers[0]->getUID();
				}
			} else {
				$uid = $input;
			}

			if (!$uid) continue;

			$resolvedUsers[] = $uid;
			$userObj = $userManager->get($uid);
			$email = $userObj ? strtolower($userObj->getEMailAddress()) : null;
			$key = $email ?: $uid;
			$inputMap[$uid] = $key;
		}


		// PROCESSA USUÁRIOS
		foreach ($resolvedUsers as $user) {

			try {
				$principal = "principals/users/$user";
				$calendars = $this->calDavBackend->getCalendarsForUser($principal);
			} catch (\Exception $e) {
				continue;
			}

			$busy = [];

			$userObj = $userManager->get($user);
			$userEmail = $userObj ? strtolower($userObj->getEMailAddress()) : null;
			$userName = $userObj? $userObj->getDisplayName() : $user;

			$caldavRangeStart = new \DateTime($start, new \DateTimeZone('UTC'));

			$caldavDayStart = clone $caldavRangeStart;
			$caldavDayStart->setTime(0, 0, 0);

			$caldavDayEnd = clone $caldavRangeStart;
			$caldavDayEnd->setTime(23, 59, 59);


			foreach ($calendars as $calendar) {

				// Ignora os calendários de inscrições e de aniversários
				if (isset($calendar['uri']) && (str_contains($calendar['uri'], 'birthday') || str_contains($calendar['uri'], 'subscription'))) { continue; }

				// Não procurar por toda a vida do usuário no caldav, se tiver muitos eventos consome CPU e demora na resposta, filtrar pelo dia
				$objects = $this->calDavBackend->calendarQuery(
					$calendar['id'],
					[
						'name' => 'VCALENDAR',
						'is-not-defined' => false,
						'prop-filters' => [],
						'comp-filters' => [
							[
								'name' => 'VEVENT',
								'is-not-defined' => false,
								'prop-filters' => [],
								'comp-filters' => [],
								'time-range' => [
									'start' => $caldavDayStart,
									'end' => $caldavDayEnd,
								]
							]
						]
					]
				);

				foreach ($objects as $uri) {

					$object = $this->calDavBackend->getCalendarObject($calendar['id'], $uri);

					if (!isset($object['calendardata'])) continue;

					try {
						$vObject = \Sabre\VObject\Reader::read($object['calendardata']);
					} catch (\Exception $e) {
						continue;
					}

					$status = (string) $vObject->VEVENT->STATUS;
					$transp = strtoupper((string)($vObject->VEVENT->TRANSP ?? ''));

					// Se o evento foi cancelado ou é transparente (lembrete, aniversário), nem vamos perder tempo em ocupar a timeline
					if (strtoupper($status) === 'CANCELLED' || $transp === 'TRANSPARENT') { continue; }

					if (!isset($vObject->VEVENT)) continue;

					$organizer = null;

					if (isset($vObject->VEVENT->ORGANIZER)) {
						$organizer = (string) $vObject->VEVENT->ORGANIZER;
					}

					$shouldBlock = false;

					// evento pessoal (sem attendees) ocupa agenda normalmente
					if (!isset($vObject->VEVENT->ATTENDEE)) {
						$shouldBlock = true;
					}

					// se for organizador sempre conta
					if ($organizer && $userEmail) {

						$orgEmail = strtolower(
							str_replace('mailto:', '', $organizer)
						);

						if ($orgEmail === $userEmail) {
							$shouldBlock = true;
						}
					}

					// convites, só bloqueia se aceito
					if (isset($vObject->VEVENT->ATTENDEE)) {

						foreach ($vObject->VEVENT->ATTENDEE as $attendee) {

							$email = strtolower(
								str_replace('mailto:', '', (string)$attendee)
							);

							$partstat = strtoupper(
								(string)$attendee['PARTSTAT']
							);

							if ($userEmail && $email === $userEmail) {

								if ($partstat === 'ACCEPTED') {
									$shouldBlock = true;
								}

								break;
							}
						}
					}

					$dtStart = $vObject->VEVENT->DTSTART;
					$dtEnd   = $vObject->VEVENT->DTEND;

					$isAllDay = !$dtStart->hasTime();

					if ($isAllDay) {
						$startRaw = $dtStart->getValue(); // "20260428"
						$endRaw   = $dtEnd->getValue();   // "20260429"

						$tz = new \DateTimeZone('America/Sao_Paulo');

						// cria já com timezone correto (SEM conversão depois)
						$startDate = \DateTime::createFromFormat('Ymd', $startRaw, $tz);
						$endDate   = \DateTime::createFromFormat('Ymd', $endRaw, $tz);

						// DTEND é exclusivo
						$endDate->modify('-1 day');

						$eventStart = (clone $startDate)->setTime(0, 0, 0);
						$eventEnd   = (clone $endDate)->setTime(23, 59, 59);

					} else {

						$eventStart = $dtStart->getDateTime();
						$eventEnd   = $dtEnd->getDateTime();

						$tz = new \DateTimeZone('America/Sao_Paulo');

						$eventStart->setTimezone($tz);
						$eventEnd->setTimezone($tz);
					}

					$summary = (string) $vObject->VEVENT->SUMMARY;
					$location = (string) $vObject->VEVENT->LOCATION;
					$description = (string) $vObject->VEVENT->DESCRIPTION;
					$organizer = $vObject->VEVENT->ORGANIZER;

					$organizerEmail = strtolower(
						str_replace('mailto:', '', (string) $organizer)
					);

					$organizerName =
						isset($organizer['CN'])
							? trim((string) $organizer['CN'])
							: null;

					// fallback automático
					if (
						(!$organizerName || $organizerName === '') &&
						$organizerEmail
					) {

						$foundUsers = $userManager->getByEmail($organizerEmail);

						if (!empty($foundUsers)) {

							$organizerName =
								$foundUsers[0]->getDisplayName();

						} else {

							// fallback federado
							$remoteOrganizer =
								$this->fetchRemoteFreeBusy(
									$organizerEmail,
									date('c'),
									date('c')
								);

							$organizerName =
								$remoteOrganizer['name']
								?? $organizerEmail;
						}
					}

					// normaliza para minutos
					$eventStartTs = (int) floor($eventStart->getTimestamp() / 60);
					$eventEndTs   = (int) floor($eventEnd->getTimestamp() / 60);
	
					try {
						$tz = new \DateTimeZone('America/Sao_Paulo');

						$rangeStartDate = new \DateTime($start, new \DateTimeZone('UTC'));
						$rangeStartDate->setTimezone($tz);

					} catch (\Exception $e) {
						continue;
					}

					$dayStart = clone $rangeStartDate;
					$dayStart->setTime(0, 0, 0);

					$dayEnd = clone $rangeStartDate;
					$dayEnd->setTime(23, 59, 59);

					// volta pra UTC pra comparar com eventos
					$dayStart->setTimezone(new \DateTimeZone('UTC'));
					$dayEnd->setTimezone(new \DateTimeZone('UTC'));

					$dayStartTs = (int) floor($dayStart->getTimestamp() / 60);
					$dayEndTs   = (int) floor($dayEnd->getTimestamp() / 60);
	
					if ($isAllDay) {
						// evento de dia inteiro ocupa o dia todo
						if ($eventStartTs < $dayEndTs && $eventEndTs > $dayStartTs) {
					
							$busy[] = [
								'start' => $eventStart->format('c'),
								'end'   => $eventEnd->format('c'),
								'summary' => $summary,
								'location' => $location,
								'status' => $status,
								'organizer' => [
									'name' => $organizerName,
									'email' => $organizerEmail,
								],
								'description' => mb_substr($description, 0, 50),
								'allDay' => true
							];
						}
					
					} else {
						$eventStart = new \DateTime($eventStart->format('Y-m-d H:i:00'), $eventStart->getTimezone());
						$eventEnd   = new \DateTime($eventEnd->format('Y-m-d H:i:00'), $eventEnd->getTimezone());	
						// evento normal (com hora)
						if ($shouldBlock && $eventEndTs > $dayStartTs && $eventStartTs < $dayEndTs) {
					
							$busy[] = [
								'start' => $eventStart->format('c'),
								'end'   => $eventEnd->format('c'),
								'summary' => $summary,
								'location' => $location,
								'status' => $status,
								'organizer' => [
									'name' => $organizerName,
									'email' => $organizerEmail,
								],
								'description' => mb_substr($description, 0, 50),
								'allDay' => false
							];
						}
					}
				}
			}
			$key = $inputMap[$user] ?? $userEmail ?? $user;
			$result[$key] = [
				'uid' => $user,
				'name' => $userName,
				'email' => $userEmail,
				'avatar' => $this->getAvatarUrl($user, $userEmail),
				'events' => $busy
			];
		}
    	return new JSONResponse($result);
  	}
}
