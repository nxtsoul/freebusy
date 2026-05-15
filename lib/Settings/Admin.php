<?php

namespace OCA\Freebusy\Settings;

use OCP\AppFramework\Http\TemplateResponse;
use OCP\Settings\ISettings;

class Admin implements ISettings {

    public function getForm(): TemplateResponse {

        return new TemplateResponse(
            'freebusy',
            'admin'
        );
    }

    public function getSection(): string {
        return 'freebusy';
    }

    public function getPriority(): int {
        return 10;
    }
}
