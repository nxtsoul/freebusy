function renderTimelineSkeleton() {

    const hours = generateHours();
    const fakeUsers = 1;

    let html = `
    <div class="availability-wrapper">
        <div class="availability-table">
        <table class="availability-grid loading">
    `;

    // header
    html += `<tr>
        <th class="availability-user-header">Usuário</th>`;

    hours.forEach(h => {
        html += `<th class="availability-hour">${String(h).padStart(2,'0')}h</th>`;
    });

    html += `</tr>`;

    // 2 ou 3 usuários fake
    for (let u = 0; u < fakeUsers; u++) {

        html += `<tr>`;

        html += `
            <td class="availability-user-cell">
                <div class="user-avatar skeleton-avatar"></div>
            </td>
        `;

        hours.forEach(() => {

            html += `<td class="availability-cell">`;

            html += `<div class="hour-slot">`;

            for (let i = 0; i < 1; i++) {
                html += `<div class="slot skeleton-slot"></div>`;
            }

            html += `</div></td>`;
        });

        html += `</tr>`;
    }

    html += `</table></div></div>`;

    return html;
}

function parsePtBrDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    // "13 de mai. de 2026"
    const months = {
        jan: 0, fevereiro: 1, fev: 1,
        mar: 2,
        abr: 3,
        maio: 4, mai: 4,
        jun: 5,
        jul: 6,
        ago: 7,
        set: 8,
        out: 9,
        nov: 10,
        dez: 11
    };
    const match = dateStr.toLowerCase().match(/(\d{1,2}) de (\w+)\.? de (\d{4})/);
    if (!match) return null;
    const day = parseInt(match[1]);
    const month = months[match[2]];
    const year = parseInt(match[3]);
    const [h, m] = timeStr.split(':').map(Number);
    return new Date(year, month, day, h, m, 0);
}

function extractDateTime(modal, block) {
    // NOVO CALENDAR (Vue Date Picker)
    const dpInput = block.querySelector('.dp__input');
    if (dpInput && dpInput.value) { return dpInput.value.trim(); }
    // FALLBACK ANTIGO
    const date = block.querySelector('input[type="date"]')?.value;
    const time = block.querySelector('input[type="time"]')?.value;
    if (date && time) { return `${date}T${time}`; }
    return null;
}

function observeCalendarViews() {
    let currentModal = null;
    const observer = new MutationObserver(() => {
	if(!isCalendarPage()){
	    return;
	}
        const modal =
            document.querySelector('.event-popover__inner') ||
            document.querySelector('.event-editor') ||
            document.querySelector('.event-popover') ||
            document.querySelector('.fc-event-editor') ||
            document.querySelector('.modal-container__content');
        if (!modal) {
            currentModal = null;
            lastHash = '';
            document.querySelector('#availability-box')?.remove();
            return;
        }
        const alreadyInjected = modal.querySelector('#availability-box');
        // 🔥 condição correta:
        if (modal !== currentModal || !alreadyInjected) {
            currentModal = modal;
            lastHash = '';
            // evita duplicar MESMO em race condition
            if (!alreadyInjected) {
                injectAvailability(modal);
            }
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}
observeCalendarViews();
window.addEventListener('popstate', () => { document.querySelector('#availability-box')?.remove(); });
// Bloquear ação no frontend ???
/*document.addEventListener('click', (e) => {
    if (e.target.innerText?.includes('Salvar')) {
        const data = window.__availabilityData;
        if (data?.hasConflict) {
            e.preventDefault();
            e.stopPropagation();
            alert('Conflito de horário detectado!');
        }
    }
});*/

let availabilityTimeout = null;
let participantsObserver = null;
let lastParticipantsHash = '';

function isCalendarPage() {
    return location.pathname.includes(
        '/apps/calendar'
    );
}

function observeParticipants(modal) {
    const list = modal.querySelector('.invitees-list');
    if (!list) return;
    if (participantsObserver) {
        participantsObserver.disconnect();
    }
    const checkParticipants = () => {
        const users = getUsers().map(u => u.toLowerCase()).sort();
        const hash = JSON.stringify(users);
        // nada mudou
        if (hash === lastParticipantsHash) { return; }
        lastParticipantsHash = hash;
        lastHash = '';
        triggerLoad();
    };
    participantsObserver = new MutationObserver(() => {
        clearTimeout(window.__participantsDebounce);
        window.__participantsDebounce = setTimeout(() => { checkParticipants(); }, 300);
    });

    participantsObserver.observe(list, { childList: true, subtree: true });
    // inicializa estado
    checkParticipants();
}

function getFreeSlots(events, rangeStart, rangeEnd) {
    const busy = events.map(e => ({ start: new Date(e.start).getTime(), end: new Date(e.end).getTime() })).sort((a, b) => a.start - b.start);
    const slots = [];
    let cursor = rangeStart;
    for (const b of busy) {
        if (cursor < b.start) { slots.push({ start: cursor, end: b.start }); }
        cursor = Math.max(cursor, b.end);
    }
    if (cursor < rangeEnd) { slots.push({ start: cursor, end: rangeEnd }); }
    return slots;
}

function waitParticipantsAndLoad(retries = 30) {
    const users = getUsers();
    // 👇 espera até ter pelo menos 1 usuário válido REAL
    const validUsers = users.filter(u => u && u.length > 0 );
    if (validUsers.length === 0 && retries > 0) {
        setTimeout(() => waitParticipantsAndLoad(retries - 1), 300);
        return;
    }
    setTimeout(() => { triggerLoad(); }, 1000);
}

function updateAvailabilityWarning(hasConflict) {
    const el = document.getElementById('availability-title-warning');
    if (!el) return;
    if (hasConflict) {
        el.style.display = 'block';
        el.innerHTML = `Um ou mais participantes não estão disponíveis neste horário`;
    } else {
        el.style.display = 'none';
        el.innerHTML = '';
    }
}

function injectAvailability(modal) {
    const box = document.createElement('div')
    box.id = 'availability-box'
    box.innerHTML = `
    <div class="availability-title" style="display:flex;gap:15px;font-size:16px;font-weight:bold;margin-bottom:15px;margin-top:10px;">
        <span aria-hidden="true" role="img" class="material-design-icon account-multiple-outline-icon">
            <svg fill="currentColor" width="20" height="20" viewBox="0 0 24 24" class="material-design-icon__svg">
            <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z" />
        </svg>
        </span>
        <div style="line-height:1.3;">
            <span class="availability-title-text">Disponibilidade</span>
            <span id="availability-title-warning"></span>
        </div>
    </div>
    <div id="availability-warning" style="display:none;"></div>
    <div id="availability-content">${renderTimelineSkeleton()}</div>
    <div class="availability-legend">
        <div class="availability-legend-item">
            <div class="availability-legend-color free"></div>
            <span>Livre</span>
        </div>
        <div class="availability-legend-item">
            <div class="availability-legend-color selected"></div>
            <span>Horário selecionado</span>
        </div>
        <div class="availability-legend-item">
            <div class="availability-legend-color busy"></div>
            <span>Ocupado</span>
        </div>
        <div class="availability-legend-item">
            <div class="availability-legend-color selected-conflict"></div>
            <span>Conflito</span>
        </div>

    </div>
    `
    // coloca depois da lista de participantes
    const target = modal.querySelector('.invitees-list')
    if (target) {
        target.appendChild(box);
        waitParticipantsAndLoad();
	    observeParticipants(modal);
	    observeDateChanges(modal);
        observeAllDay(modal);
    }
}

function getEventRange() {

    const modal = document.querySelector(
        '.event-popover__inner, .event-editor, .modal-container__content, .fc-event-editor'
    );

    if (!modal) return null;

    const fromBlock = modal.querySelector(
        '.property-title-time-picker__time-pickers-from'
    );

    const toBlock = modal.querySelector(
        '.property-title-time-picker__time-pickers-to'
    );

    if (!fromBlock || !toBlock) {
        return null;
    }

    const isAllDay =
        modal.querySelector('input[type="checkbox"]')?.checked || false;

    let startDate;
    let startTime;
    let endDate;
    let endTime;

    // =========================================================
    // NEXTCLOUD 33+ (Vue date picker)
    // =========================================================

    const fromDp = fromBlock.querySelectorAll('.dp__input');
    const toDp   = toBlock.querySelectorAll('.dp__input');

    if (fromDp.length >= 2 && toDp.length >= 2) {

        startDate = fromDp[0]?.value;
        startTime = fromDp[1]?.value;

        endDate = toDp[0]?.value;
        endTime = toDp[1]?.value;

        const start = parsePtBrDateTime(startDate, isAllDay ? '00:00' : startTime);
        const end   = parsePtBrDateTime(endDate, isAllDay ? '23:59' : endTime);

        if (!start || !end) {

            console.warn('[Availability] falha parsing dp__input:', {
                startDate,
                startTime,
                endDate,
                endTime
            });

            return null;
        }

        return {
            start: start.toISOString(),
            end: end.toISOString()
        };
    }

    // =========================================================
    // NEXTCLOUD 32 (input native)
    // =========================================================

    startDate = fromBlock.querySelector('input[type="date"]')?.value;
    startTime = fromBlock.querySelector('input[type="time"]')?.value;

    endDate = toBlock.querySelector('input[type="date"]')?.value;
    endTime = toBlock.querySelector('input[type="time"]')?.value;

    if (!startDate || !endDate) {

        console.warn('[Availability] falha parsing legacy:', {
            startDate,
            startTime,
            endDate,
            endTime
        });

        return null;
    }

    const start = new Date(
        `${startDate}T${isAllDay ? '00:00' : startTime}`
    );

    const end = new Date(
        `${endDate}T${isAllDay ? '23:59' : endTime}`
    );

    return {
        start: start.toISOString(),
        end: end.toISOString()
    };
}

function createUserTooltip(user) {
    return `
        <div class="availability-user-tooltip">
            <div class="availability-user-tooltip-name">
                <b>👤 ${escapeHtml(user.name || user.email || 'Sem nome')}</b>
            </div>
            ${
                user.email
                    ? `
                        <div class="availability-user-tooltip-email">✉️ ${escapeHtml(user.email)}</div>
                    `
                    : ''
            }
        </div>
    `;
}

function observeDateChanges(modal) {

    let lastHash = '';
    let listenersAttached = false;

    const check = () => {

        const dates = [
            ...modal.querySelectorAll('input[type="date"], .dp__input')
        ].map(i => i.value);

        const times = [
            ...modal.querySelectorAll('input[type="time"], .dp__input')
        ].map(i => i.value);

        // 🔥 NOVO CALENDÁRIO (Nextcloud Vue)
        const dpDates = [
            ...modal.querySelectorAll('.dp__input')
        ].map(i => i.value);

        const allDay =
            modal.querySelector('input[type="checkbox"]')?.checked || false;

        const hash = JSON.stringify({
            dates,
            times,
            dpDates,
            allDay
        });

        if (hash !== lastHash) {
            lastHash = hash;
            triggerLoad();
        }
    };

    // eventos antigos (mantém compatibilidade)
    modal.addEventListener('input', check, true);
    modal.addEventListener('change', check, true);
    modal.addEventListener('click', check, true);

    // 🔥 NOVO: listeners diretos no Vue date picker (IMPORTANTE)
    const attachDpListeners = () => {

        if (listenersAttached) return;
        listenersAttached = true;

        modal.querySelectorAll('.dp__input').forEach(el => {

            el.addEventListener('input', () => {
                setTimeout(check, 150);
            });

            el.addEventListener('change', () => {
                setTimeout(check, 150);
            });
        });
    };

    // MutationObserver continua útil porque Vue recria inputs
    const observer = new MutationObserver(() => {
        check();
        attachDpListeners(); // 🔥 reaplica quando Vue re-renderiza
    });

    observer.observe(modal, {
        childList: true,
        subtree: true,
        attributes: true
    });

    // inicialização
    attachDpListeners();
    check();
}

function observeAllDay(modal) {

    let lastChecked = null;

    const observer = new MutationObserver(() => {

        const checkbox = modal.querySelector(
            'input[type="checkbox"]'
        );

        if (!checkbox) {
            return;
        }

        // inicializa estado
        if (lastChecked === null) {
            lastChecked = checkbox.checked;
        }

        // mudou estado?
        if (checkbox.checked !== lastChecked) {

            lastChecked = checkbox.checked;

            lastHash = '';

            triggerLoad();
        }
    });

    observer.observe(modal, {
        childList: true,
        subtree: true,
        attributes: true
    });
}

async function loadAvailability() {
    const users = getUsers();

    if (users.length === 0) return;

    const range = getEventRange();

    if (!range) {
        console.warn('[Availability] range não encontrado');
        return;
    }

    const url = `/index.php/apps/freebusy/freebusy?users=${users.join(',')}&start=${range.start}&end=${range.end}`;

    const res = await fetch(url);
    const text = await res.text();

    if (text.startsWith('<')) {
        console.error('Resposta inválida (HTML):', text);
        return;
    }

    const data = JSON.parse(text);

    renderTimeline(data, range.start);
    enableTooltips();
    window.__availabilityData = { data, hasConflict: hasConflict(data, range.start, range.end) };
    updateAvailabilityWarning(window.__availabilityData.hasConflict);
    const scrollContainer = document.querySelector('#availability-content div');
    enableDragScroll(scrollContainer);
    enableHorizontalWheelScroll(scrollContainer);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            setTimeout(() => { scrollToCurrentRange(range.start); }, 100);
        });
    });
}

function enableTooltips() {

    document.querySelectorAll('.slot.busy').forEach(slot => {

        bindTooltip(slot, () => {

            const raw = slot.dataset.events;
            if (!raw) return '';

            const events = JSON.parse(
                decodeURIComponent(raw)
            );

            return renderTooltipContent(events);
        });
    });
}

function renderTooltipContent(events) {

    return events.map(ev => {

        const start = new Date(ev.start);
        const end   = new Date(ev.end);

	const formatDate = d =>
	    d.toLocaleDateString('pt-BR', {
	        day: 'numeric',
	        month: 'long',
	        year: 'numeric'
	    });
	
	const formatTime = d =>
	    d.toLocaleTimeString('pt-BR', {
	        hour: '2-digit',
	        minute: '2-digit'
	    });

	const dateText = `${formatDate(start)} das ${formatTime(start)} às ${formatTime(end)}`;

        return `
            <div class="tooltip-event">
                <div class="tooltip-title">${ev.summary || 'Sem título'}</div>

                <div class="tooltip-row">
                    🕒 <b>Data:</b> ${dateText}
                </div>

                ${ev.location ? `
                    <div class="tooltip-row">📍 <b>Local:</b> ${ev.location}</div>
                ` : ''}

                ${ev.organizer.name ? `
                    <div class="tooltip-row">
                        👤 <b>Organizador:</b> ${ev.organizer.name}
                    </div>
                    ` : ''
                }

                ${ev.description ? `
                    <div class="tooltip-desc">
                        <b>📝 Descrição:</b> ${ev.description}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('<hr/>');
}

function scrollToCurrentRange(rangeStart) {

    const container = document.querySelector(
        '#availability-content .availability-wrapper'
    );

    if (!container) return;

    const firstHourCell = container.querySelector(
        '.availability-hour'
    );

    const userColumn = container.querySelector(
        '.availability-user-header'
    );

    if (!firstHourCell || !userColumn) return;

    const hourWidth = firstHourCell.offsetWidth;
    const userColumnWidth = userColumn.offsetWidth;

    const date = new Date(rangeStart);

    const hour = date.getHours();
    const minute = date.getMinutes();

    const visualOffset = 50;

    const position =
        userColumnWidth +
        (hour * hourWidth) +
        ((minute / 60) * hourWidth);
    
    const target =
        Math.max(
            position - (container.clientWidth / 2) +
            visualOffset,
            0
        );

    requestAnimationFrame(() => {
        container.scrollLeft = target;
    });

    setTimeout(() => {
        container.scrollLeft = target;
    }, 150);
}

function hasConflict(data, rangeStart, rangeEnd) {

    const start = new Date(rangeStart)
    const end   = new Date(rangeEnd)

    return Object.values(data).some(user => {

        const events = Array.isArray(user?.events)
            ? user.events
            : []

        return events.some(ev => {

            const evStart = new Date(ev.start)
            const evEnd   = new Date(ev.end)

            return evEnd > start && evStart < end
        })
    })
}

function getUsers() {

    const modal =
        document.querySelector('.event-popover__inner') ||
        document.querySelector('.modal-container__content') ||
        document.querySelector('.event-editor') ||
        document.querySelector('.fc-event-editor');

    const users = new Set();

    if (modal) {

        modal.querySelectorAll('.invitees-list-item [title]').forEach(el => {
            const value = el.getAttribute('title');

            if (value && value.includes('@')) {
                users.add(value.trim().toLowerCase());
            }
        });
    }

    // 🔥 fallback SEMPRE independente do modal existir
    if (users.size === 0) {
        const current = OC.getCurrentUser()?.uid;
        if (current) users.add(current);
    }

    return [...users];
}

let lastStateHash = '';

let lastHash = '';

function triggerLoad() {
    clearTimeout(availabilityTimeout);

    availabilityTimeout = setTimeout(() => {

        const users = getUsers();
        const range = getEventRange();

        if (!range || users.length === 0) {
            return;
        }

        const hash = JSON.stringify({
            users: users.sort(),
            start: range.start,
            end: range.end
        });

        if (hash === lastHash) {
            return; // 🔥 evita loop infinito
        }

        lastHash = hash;

        loadAvailability();

    }, 500);
}

function generateHours() {
    const hours = [];
    for (let i = 0; i < 24; i++) {
        hours.push(i); // só hora cheia
    }
    return hours;
}

function generateSlots() {
    const slots = [];

    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
            slots.push({ h, m });
        }
    }

    return slots;
}

function getBusySlots(events) {
    const slots = new Set();

    events.forEach(ev => {
        const start = new Date(ev.start);
        const end   = new Date(ev.end);

        let current = new Date(start);

        while (current < end) {

            const h = current.getHours();
            const m = current.getMinutes();

            // 🔥 divide em 2 blocos: 0 = 00-30 | 1 = 30-60
            const half = m < 30 ? 0 : 1;

            const key = `${h}-${half}`;
            slots.add(key);

            current.setMinutes(current.getMinutes() + 15); // mantém precisão interna
        }
    });

    return slots;
}

function enableDragScroll(el) {

    let isDown = false;
    let startX;
    let scrollLeft;

    el.addEventListener('mousedown', (e) => {
        isDown = true;
        el.classList.add('dragging');

        startX = e.pageX - el.offsetLeft;
        scrollLeft = el.scrollLeft;
    });

    el.addEventListener('mouseleave', () => {
        isDown = false;
    });

    el.addEventListener('mouseup', () => {
        isDown = false;
    });

    el.addEventListener('mousemove', (e) => {
        if (!isDown) return;

        e.preventDefault();

        const x = e.pageX - el.offsetLeft;
        const walk = (x - startX) * 1.5; // velocidade

        el.scrollLeft = scrollLeft - walk;
    });
}

function enableHorizontalWheelScroll(el) {

    el.addEventListener('wheel', (e) => {

        // se o usuário estiver scrollando verticalmente
        if (e.deltaY === 0) return;

        e.preventDefault();

        // converte scroll vertical → horizontal
        el.scrollLeft += e.deltaY;

    }, { passive: false });
}


function renderTimeline(data, rangeStart) {
    const container = document.getElementById('availability-content');
    container.className = 'availability-container';

    const hours = generateHours();
    const baseDate = new Date(rangeStart);

    let html = `
    <div class="availability-wrapper">
        <div id="timeline-scroll" class="availability-table">
        <table class="availability-grid">
    `;

    // HEADER
    html += `<tr>
        <th class="availability-user-header">Usuário</th>`;

    hours.forEach(h => {
        html += `<th class="availability-hour">${String(h).padStart(2,'0')}h</th>`;
    });

    html += `</tr>`;

    // LINHAS
    Object.entries(data).forEach(([user, userData]) => {

        const events = userData.events || [];

        const range = getEventRange();

        const userHasConflict = events.some(ev => {

            const evStart = new Date(ev.start);
            const evEnd   = new Date(ev.end);

            return (
                evEnd > new Date(range.start) &&
                evStart < new Date(range.end)
            );
        });

        const selectedStart = new Date(range.start);
        const selectedEnd   = new Date(range.end);

        html += `<tr style="border-bottom:1px solid #292929;">`;

        const name =
            userData.name ||
            userData.email ||
            user;

        const avatarUrl = `/index.php/apps/freebusy/avatar?email=${encodeURIComponent(userData.email)}`;

        html += `
            <td
                class="availability-user-cell"
                data-name="${name}"
                data-email="${userData.email || ''}"
                data-uid="${userData.uid || ''}"
            >
                <div class="user-avatar ${userHasConflict ? 'has-conflict' : ''}">
                    <img src="${avatarUrl}" />
                </div>
            </td>
        `;

        hours.forEach(hour => {

            let slotsHtml = `<div class="hour-slot">`;

            for (let i = 0; i < 4; i++) {

                const slotStart = new Date(baseDate);
                slotStart.setHours(hour, i * 15, 0, 0);

                const slotEnd = new Date(slotStart);
                slotEnd.setMinutes(slotStart.getMinutes() + 15);

                const matchedEvents = events.filter(ev => {
                    const evStart = new Date(ev.start);
                    const evEnd   = new Date(ev.end);
                    return evEnd > slotStart && evStart < slotEnd;
                });

                const isSelected =
                    slotEnd > selectedStart &&
                    slotStart < selectedEnd;

                const tooltipData = matchedEvents.length ? encodeURIComponent(JSON.stringify(matchedEvents)) : '';

                const classes = [
                    'slot',
                    matchedEvents.length ? 'busy' : 'free',
                    isSelected ? 'selected' : '',
                    matchedEvents.length && isSelected
                        ? 'selected-conflict'
                        : ''
                ].join(' ');

                slotsHtml += `
                    <div
                        class="${classes}"
                        data-events="${tooltipData}"
                    ></div>
                `;
            }

            slotsHtml += `</div>`;
            html += `<td class="availability-cell">${slotsHtml}</td>`;
        });

        html += `</tr>`;
    });

    html += `
        </table>
        </div>
    </div>
    `;

    container.innerHTML = html;

    container
    .querySelectorAll('.availability-user-cell')
    .forEach(cell => {

        bindTooltip(cell, () => {

            return createUserTooltip({
                name: cell.dataset.name,
                email: cell.dataset.email,
                uid: cell.dataset.uid
            });
        });
    });
}

function bindTooltip(element, getContent) {

    element.addEventListener('mouseenter', (e) => {

        const html = typeof getContent === 'function'
            ? getContent(element)
            : getContent;

        showTooltip(html);
        moveTooltip(e);
    });

    element.addEventListener('mousemove', moveTooltip);

    element.addEventListener('mouseleave', hideTooltip);
}

function createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.id = 'availability-tooltip';
    document.body.appendChild(tooltip);
}

function showTooltip(html) {

    const tooltip = document.getElementById('availability-tooltip');

    if (!tooltip) return;

    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
}

function moveTooltip(event) {

    const tooltip = document.getElementById('availability-tooltip');

    if (!tooltip) return;

    const tooltipWidth  = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;

    let left = event.pageX + 15;
    let top  = event.pageY - tooltipHeight - 15;

    if (top < 10) {
        top = event.pageY + 15;
    }

    if (left + tooltipWidth > window.innerWidth) {
        left = event.pageX - tooltipWidth - 15;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top  = top + 'px';
}

function hideTooltip() {

    const tooltip = document.getElementById('availability-tooltip');

    if (!tooltip) return;

    tooltip.style.display = 'none';
}

function escapeHtml(str) {

    if (!str) return '';

    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

createTooltip();

