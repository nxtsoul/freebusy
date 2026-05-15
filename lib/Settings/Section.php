<?php

namespace OCA\Freebusy\Settings;

use OCP\IL10N;
use OCP\Settings\IIconSection;

class Section implements IIconSection {

    private IL10N $l;

    public function __construct(IL10N $l) {
        $this->l = $l;
    }

    public function getID(): string {
        return 'freebusy';
    }

    public function getName(): string {
        return $this->l->t('Freebusy');
    }

    public function getPriority(): int {
        return 80;
    }

    public function getIcon(): string {

        return \OC::$server->getURLGenerator()
            ->imagePath(
                'freebusy',
                'app.svg'
            );
    }
}
