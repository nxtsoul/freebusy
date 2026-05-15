function escapeHtml(str) {

    if (!str) return '';

    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * API helper
 */
async function api(url, options = {}) {

    return fetch(url, {
        headers: {
            requesttoken: OC.requestToken,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        ...options
    });
}

/**
 * STATUS BADGE
 */
function getStatusBadge(enabled) {

    if (enabled) {
        return `
            <span class="status-badge status-active">
                Ativo
            </span>
        `;
    }

    return `
        <span class="status-badge status-inactive">
            Inativo
        </span>
    `;
}

/**
 * CREATE FEDERATION CARD
 */
function createFederationItem(row) {

    const item = document.createElement('div');
    item.classList.add('federation-item');

    item.dataset.id = row.id;

    item.innerHTML = `
        <div class="federation-info">

            <div class="federation-header">

                <strong>
                    ${escapeHtml(row.domain)}
                </strong>

                ${getStatusBadge(row.enabled)}

            </div>

            <small>
                ${escapeHtml(row.base_url)}
            </small>

        </div>

        <div class="federation-actions">

            <button
                class="action-item edit-domain"
                title="Editar"
            >
                <span class="icon icon-rename"></span>
            </button>

            <button
                class="action-item test-domain"
                title="Testar conexão"
            >
                <span class="icon icon-checkmark"></span>
            </button>

            <button
                class="action-item action-item--danger delete-domain"
                title="Remover"
            >
                <span class="icon icon-delete"></span>
            </button>

        </div>
    `;

    /**
     * EDIT
     */
    item.querySelector('.edit-domain')
        .addEventListener('click', () => {

            openEditModal(row);
        });

    /**
     * TEST CONNECTION
     */
    item.querySelector('.test-domain')
        .addEventListener('click', async () => {

            try {

                OC.Notification.showTemporary(
                    `Testando ${row.domain}...`
                );

                const response = await api(
                    `/index.php/apps/freebusy/admin/domains/${row.id}/test`,
                    {
                        method: 'POST'
                    }
                );

                if (!response.ok) {
                    throw new Error('Test failed');
                }

                OC.Notification.showTemporary(
                    'Conexão realizada com sucesso'
                );

            } catch (e) {

                console.error(e);

                OC.Notification.showTemporary(
                    'Erro ao testar conexão'
                );
            }
        });

    /**
     * DELETE
     */
    item.querySelector('.delete-domain')
        .addEventListener('click', async () => {

	    openDeleteModal(row, async () => {

            const response = await api(
                `/index.php/apps/freebusy/admin/domains/${row.id}`,
                {
                    method: 'DELETE'
                }
            );

            if (!response.ok) {
                throw new Error('Delete failed');
            }

            item.remove();

            OC.Notification.showTemporary(
                'Domínio removido'
            );
            });

        });

    return item;
}

/**
 * LOAD DOMAINS
 */
async function loadDomains() {

    const container = document.getElementById(
        'availability-domains'
    );

    const loading = document.getElementById(
        'availability-loading'
    );

    const empty = document.getElementById(
        'availability-empty'
    );

    if (!container) {
        return;
    }

    /**
     * reset
     */
    container
        .querySelectorAll('.federation-item.dynamic')
        .forEach(el => el.remove());

    empty.classList.add('hidden');

    loading.classList.remove('hidden');

    try {

        const response = await api(
            '/index.php/apps/freebusy/admin/domains'
        );

        if (!response.ok) {
            throw new Error('Load failed');
        }

        const data = await response.json();

        /**
         * loading off
         */
        loading.classList.add('hidden');

        /**
         * empty state
         */
        if (!data.length) {

            empty.classList.remove('hidden');

            return;
        }

        /**
         * render
         */
        data.forEach(row => {

            const item = createFederationItem(row);

            item.classList.add('dynamic');

            container.appendChild(item);
        });

    } catch (e) {

        loading.classList.add('hidden');

        console.error(
            '[Availability Admin] loadDomains error:',
            e
        );

        OC.Notification.showTemporary(
            'Erro ao carregar domínios'
        );
    }
}

function openEditModal(row = null) {

    const isNew = !row;

    const overlay = document.getElementById(
        'availability-modal-overlay'
    );

    const title = document.getElementById(
        'availability-modal-title'
    );

    const domainInput = document.getElementById(
        'availability-domain'
    );

    const baseUrlInput = document.getElementById(
        'availability-base-url'
    );

    const tokenInput = document.getElementById(
        'availability-token'
    );

    const enabledInput = document.getElementById(
        'availability-enabled'
    );

    const saveBtn = document.getElementById(
        'availability-save'
    );

    const closeBtn = document.getElementById(
        'availability-modal-close'
    );

    /**
     * SET TITLE
     */
    title.textContent = isNew
        ? 'Adicionar Federação'
        : 'Editar Federação';

    /**
     * FILL FORM
     */
    domainInput.value = row?.domain || '';

    baseUrlInput.value = row?.base_url || '';

    tokenInput.value = row?.token || '';

    enabledInput.checked = !!row?.enabled;

    /**
     * OPEN
     */
requestAnimationFrame(() => {
    overlay.classList.remove('hidden');
});
    /**
     * CLOSE FUNCTION
     */
    const closeModal = () => {

    overlay.classList.add('hidden');

    setTimeout(() => {

        saveBtn.replaceWith(
            saveBtn.cloneNode(true)
        );
	if (closeBtn) {
        	closeBtn.replaceWith(
            	    closeBtn.cloneNode(true)
        	);
	}

    }, 180);
};
    /**
     * CLOSE EVENTS
     */
    overlay.addEventListener('click', (e) => {

        if (e.target === overlay) {
            closeModal();
        }
    });

    document
        .getElementById('availability-modal-close')
        .addEventListener('click', closeModal);

    /**
     * SAVE EVENT
     */
    document
        .getElementById('availability-save')
        .addEventListener('click', async () => {

            const domain = domainInput.value.trim();

            const base_url = baseUrlInput.value.trim();

            const token = tokenInput.value.trim();

            const enabled = enabledInput.checked ? 1 : 0;

            if (!domain || !base_url || !token) {

                OC.Notification.showTemporary(
                    'Preencha todos os campos'
                );

                return;
            }

            try {

                const payload = {
                    domain,
                    base_url,
                    token,
                    enabled
                };

                const url = isNew
                    ? '/index.php/apps/freebusy/admin/domains'
                    : `/index.php/apps/freebusy/admin/domains/${row.id}`;

                const response = await api(url, {
                    method: isNew ? 'POST' : 'PUT',
                    body: new URLSearchParams(payload)
                });

                if (!response.ok) {
                    throw new Error('Save failed');
                }

                OC.Notification.showTemporary(
                    isNew
                        ? 'Domínio adicionado'
                        : 'Domínio atualizado'
                );

                closeModal();

                loadDomains();

            } catch (e) {

                console.error(e);

                OC.Notification.showTemporary(
                    'Erro ao salvar domínio'
                );
            }
        });
}

function openDeleteModal(row, onConfirm) {

    const overlay = document.getElementById(
        'availability-delete-overlay'
    );

    const text = document.getElementById(
        'availability-delete-text'
    );

    const closeBtn = document.getElementById(
        'availability-delete-close'
    );

    const cancelBtn = document.getElementById(
        'availability-delete-cancel'
    );

    const confirmBtn = document.getElementById(
        'availability-delete-confirm'
    );

    text.innerHTML = `
        Deseja remover a federação para o domínio 
        <strong>${escapeHtml(row.domain)}</strong> ?
    `;

    requestAnimationFrame(() => {
        overlay.classList.remove('hidden');
    });

    const closeModal = () => {

        overlay.classList.add('hidden');

        setTimeout(() => {

            confirmBtn.replaceWith(
                confirmBtn.cloneNode(true)
            );

            cancelBtn.replaceWith(
                cancelBtn.cloneNode(true)
            );

            closeBtn.replaceWith(
                closeBtn.cloneNode(true)
            );

        }, 220);
    };

    /**
     * overlay click
     */
    overlay.addEventListener('click', (e) => {

        if (e.target === overlay) {
            closeModal();
        }
    });

    /**
     * close
     */
    if (closeBtn) {
	closeBtn.addEventListener(
	    'click',
	    closeModal
	);
    }

    /**
     * cancel
     */
    document
        .getElementById('availability-delete-cancel')
        .addEventListener('click', closeModal);

    /**
     * confirm
     */
    document
        .getElementById('availability-delete-confirm')
        .addEventListener('click', async () => {

            try {

                await onConfirm();

                closeModal();

            } catch (e) {

                console.error(e);

                OC.Notification.showTemporary(
                    'Erro ao remover domínio'
                );
            }
        });
}

/**
 * INIT
 */
function initAdmin() {

    const addBtn = document.getElementById(
        'availability-add-domain'
    );

    if (!addBtn) {
        return;
    }

    if (addBtn.dataset.initialized) {
        return;
    }

    addBtn.dataset.initialized = '1';


    loadDomains();

    /**
     * ADD DOMAIN
     */
    addBtn.addEventListener('click', () => {

        openEditModal();
    });
}

/**
 * NEXTCLOUD SAFE INIT
 */
const observer = new MutationObserver(() => {

    initAdmin();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

initAdmin();
