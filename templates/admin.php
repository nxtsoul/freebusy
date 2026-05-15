<?php

script('freebusy', 'admin');
style('freebusy', 'admin');

?>
<div class="availability-container">

    <!-- TÍTULO -->
    <h1 class="availability-title">
        Configurações do Availability
    </h1>

    <!-- DESCRIÇÃO -->
    <p class="availability-description">
        Gerencie a visualização de disponibilidade (Free/Busy) entre usuários locais e domínios federados.
        Estas configurações controlam como o calendário compartilha informações de agenda entre instâncias.
    </p>

    <!-- FEDERAÇÃO -->
    <section class="availability-section">

        <h2>Federação do Availability</h2>

        <p class="availability-subtitle">
            Configure aqui os domínios remotos e os tokens de acesso para consulta de disponibilidade.
        </p>

        <!-- LISTA DE DOMÍNIOS -->
	<div id="availability-domains" class="federation-list">
		<div id="availability-empty" class="availability-empty hidden">

		    <strong>
		        Nenhum domínio remoto cadastrado
		    </strong>
		    <small>
		        Adicione uma federação para compartilhar disponibilidade entre instâncias.
		    </small>
		</div>

		<div id="availability-loading" class="availability-loading"> 
		    <div class="availability-skeleton"></div>
		</div>

	</div>

        <!-- ADICIONAR -->
        <div class="add-federation">
            <button id="availability-add-domain" class="action-item" title="Adicionar">
		<span class="icon icon-add"></span>
		Adicionar
            </button>
        </div>
	
    </section>

<div id="availability-modal-overlay" class="availability-modal-overlay hidden">

    <div class="availability-modal">

        <div class="availability-modal-header">

            <h2 id="availability-modal-title">
                Editar Federação
            </h2>

            <button
                id="availability-modal-close"
                class="action-item"
            >
                <span class="icon icon-close"></span>
            </button>

        </div>

        <div class="availability-modal-body">

            <div class="field-group">

                <label>Domínio</label>

                <input
                    type="text"
                    id="availability-domain"
                    placeholder="domain.com"
                />

            </div>

            <div class="field-group">

                <label>URL Base</label>

                <input
                    type="text"
                    id="availability-base-url"
                    placeholder="https://nextcloud.domain.com"
                />

            </div>

            <div class="field-group">

                <label>Token</label>

                <input
                    type="text"
                    id="availability-token"
                    placeholder="abcd1234"
                />

            </div>

            <label class="checkbox-label">

                <input
                    type="checkbox"
                    id="availability-enabled"
                />

                Federação ativa

            </label>

        </div>

        <div class="availability-modal-footer">

            <button
                id="availability-save"
                class="primary"
            >
                Salvar
            </button>

        </div>

    </div>

</div>

<div id="availability-delete-overlay" class="availability-modal-overlay hidden">

    <div class="availability-modal availability-delete-modal">

        <div class="availability-modal-header">

            <h2>
                Remover Federação
            </h2>

        </div>

        <div class="availability-modal-body">

            <p id="availability-delete-text">
                Deseja remover esta federação?
            </p>

        </div>

        <div class="availability-modal-footer">

            <button
                id="availability-delete-cancel"
            >
                Cancelar
            </button>

            <button
                id="availability-delete-confirm"
                class="primary error"
            >
                Remover
            </button>

        </div>

    </div>

</div>

    <!-- CRÉDITOS
    <div class="availability-credits">
        <span>Módulo Availability v1.0</span>
        <span>Desenvolvido por <strong>Natã Andreghetone</strong></span>
    </div-->
</div>
