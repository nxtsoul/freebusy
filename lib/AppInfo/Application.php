<?php

namespace OCA\Freebusy\AppInfo;

use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IRegistrationContext;

class Application extends App implements IBootstrap {

    public function __construct() {
        parent::__construct('freebusy');
    }

    public function register(IRegistrationContext $context): void {
    }

    public function boot(IBootContext $context): void {
        \OCP\Util::addScript('freebusy', 'main');
        \OCP\Util::addStyle('freebusy', 'style');
    }
}
