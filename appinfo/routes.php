<?php
return [
    'routes' => [
        [
            'name' => 'Freebusy#getFreeBusy',
            'url' => '/freebusy',
	    'verb' => 'GET',
	    'defaults' => [
	    	'_public' => true
	    ]
	],
	[
	    'name' => 'Freebusy#avatar',
	    'url' => '/avatar',
	    'verb' => 'GET',
	    'defaults' => [
	    	'_public' => true
	    ]
	],
	[
            'name' => 'admin#index',
            'url' => '/admin/domains',
            'verb' => 'GET'
        ],
        [
            'name' => 'admin#create',
            'url' => '/admin/domains',
            'verb' => 'POST'
        ],
        [
            'name' => 'admin#update',
            'url' => '/admin/domains/{id}',
            'verb' => 'PUT'
        ],
        [
            'name' => 'admin#delete',
            'url' => '/admin/domains/{id}',
            'verb' => 'DELETE'
        ]
    ]
];
