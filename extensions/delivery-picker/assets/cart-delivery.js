(function () {
  const configEl = document.getElementById('figur-delivery-config');
  const PROXY_URL = configEl?.dataset.proxyUrl ?? '/apps/delivery/availability';
  const DEFAULT_ATTR_DATE = configEl?.dataset.attrDate ?? 'Delivery Date';
  const DEFAULT_ATTR_SLOT = configEl?.dataset.attrSlot ?? 'Delivery Slot';

  function formatDisplayDate(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-AE', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  }

  function buildSlotOptions(slots, selectedSlot, placeholder) {
    const ph = placeholder || 'Select delivery time';
    const placeholderOpt = `<option value=""${selectedSlot ? '' : ' selected'}>${ph}</option>`;
    const opts = slots
      .map((s) => `<option value="${s.value}"${s.value === selectedSlot ? ' selected' : ''}>${s.label}</option>`)
      .join('');
    return placeholderOpt + opts;
  }

  class CartDelivery extends HTMLElement {
    connectedCallback() {
      this._attrDate = this.dataset.attrDate || DEFAULT_ATTR_DATE;
      this._attrSlot = this.dataset.attrSlot || DEFAULT_ATTR_SLOT;
      this._slotPlaceholder = this.dataset.slotPlaceholder || 'Select delivery time';
      this._errorText = this.dataset.errorText || 'Please select a delivery date and time before checking out.';

      this._savedDate = this.dataset.savedDate || '';
      this._savedSlot = this.dataset.savedSlot || '';
      this._selectedDate = this._savedDate;
      this._selectedSlot = this._savedSlot;

      this._availability = null;
      this._loadAvailability();
      this._bindSlotChange();
      this._bindCheckoutGuard();
    }

    async _loadAvailability() {
      try {
        const cart = await fetch('/cart.js').then((r) => r.json());
        const productIds = (cart.items || []).map((item) => {
          const numId = item.product_id;
          return `gid://shopify/Product/${numId}`;
        });

        const body = {
          productIds,
          attrDate: this._attrDate,
          attrSlot: this._attrSlot,
        };

        const res = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          console.warn('[CartDelivery] proxy returned', res.status);
          return;
        }

        this._availability = await res.json();
        this._initFlatpickr();
        this._restoreSlots();
      } catch (err) {
        console.error('[CartDelivery] availability fetch failed', err);
      }
    }

    _initFlatpickr() {
      const av = this._availability;
      if (!av || typeof flatpickr === 'undefined') return;

      const dateInput = this.querySelector('.cart-delivery__date-input');
      const calendarWrap = this.querySelector('.cart-delivery__calendar-wrap');
      if (!dateInput) return;

      const disabledDates = [
        ...av.blackoutDates,
        (date) => {
          const dow = date.getUTCDay();
          return av.disabledWeekdays.includes(dow);
        },
      ];

      this._flatpickr = flatpickr(dateInput, {
        inline: true,
        appendTo: calendarWrap,
        minDate: av.minDate,
        maxDate: av.maxDate,
        dateFormat: 'Y-m-d',
        defaultDate: this._savedDate || null,
        disableMobile: true,
        locale: { firstDayOfWeek: 1 },
        disable: disabledDates,
        onChange: (_, dateStr) => this._onDateChange(dateStr),
      });
    }

    _restoreSlots() {
      if (!this._savedDate || !this._availability) return;
      const slots = this._slotsForDate(this._savedDate);
      const slotSelect = this.querySelector('.cart-delivery__slot-select');
      if (slotSelect) {
        slotSelect.innerHTML = buildSlotOptions(slots, this._savedSlot, this._slotPlaceholder);
        slotSelect.disabled = slots.length === 0;
      }
    }

    _slotsForDate(isoDate) {
      if (!this._availability) return [];
      const byDate = this._availability.slotsByDate?.[isoDate];
      return byDate ?? this._availability.defaultSlots ?? [];
    }

    _onDateChange(isoDate) {
      const slotSelect = this.querySelector('.cart-delivery__slot-select');
      const slots = this._slotsForDate(isoDate);
      if (slotSelect) {
        slotSelect.innerHTML = buildSlotOptions(slots, '', this._slotPlaceholder);
        slotSelect.disabled = slots.length === 0;
      }
      this._selectedDate = isoDate;
      this._selectedSlot = '';
      this._clearError();
    }

    _bindSlotChange() {
      const slotSelect = this.querySelector('.cart-delivery__slot-select');
      if (!slotSelect) return;
      slotSelect.addEventListener('change', () => {
        this._selectedSlot = slotSelect.value;
        if (slotSelect.value) this._clearError();
        this._persistToCart();
      });
    }

    isValid() {
      const dateInput = this.querySelector('.cart-delivery__date-input');
      const slotSelect = this.querySelector('.cart-delivery__slot-select');
      return Boolean(dateInput?.value?.trim() && slotSelect?.value?.trim());
    }

    _showError() {
      const el = this.querySelector('.cart-delivery__error');
      if (el) { el.textContent = this._errorText; el.hidden = false; }
      this.classList.add('cart-delivery--invalid');
    }

    _clearError() {
      const el = this.querySelector('.cart-delivery__error');
      if (el) el.hidden = true;
      this.classList.remove('cart-delivery--invalid');
    }

    _bindCheckoutGuard() {
      const root = this.closest('cart-drawer') || this.closest('cart-items-component') || document;
      root.querySelectorAll('button[name="checkout"]').forEach((btn) => {
        if (btn.__deliveryGuardBound) return;
        btn.__deliveryGuardBound = true;
        btn.addEventListener('click', (event) => {
          if (this.isValid()) { this._clearError(); return; }
          event.preventDefault();
          event.stopImmediatePropagation();
          this._showError();
          this.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, true);
      });
    }

    _persistToCart() {
      const date = this._selectedDate || this._savedDate;
      const slotSelect = this.querySelector('.cart-delivery__slot-select');
      const slotValue = slotSelect?.value || this._selectedSlot || this._savedSlot;
      if (!date || !slotValue) return;

      const allSlots = this._availability?.defaultSlots ?? [];
      const dateSlots = this._slotsForDate(date);
      const allAvailable = [...allSlots, ...dateSlots];
      const slotObj = allAvailable.find((s) => s.value === slotValue);
      const slotLabel = slotObj?.label ?? slotValue;

      const routesEl = document.querySelector('[data-cart-update-url]');
      const cartUpdateUrl = routesEl?.dataset.cartUpdateUrl ?? '/cart/update.js';

      fetch(cartUpdateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          attributes: {
            [this._attrDate]: formatDisplayDate(date),
            [this._attrSlot]: slotLabel,
            ['_' + this._attrDate]: date,
            ['_' + this._attrSlot]: slotValue,
          },
        }),
      }).catch((err) => console.error('[CartDelivery] save failed', err));
    }
  }

  if (!customElements.get('cart-delivery')) {
    customElements.define('cart-delivery', CartDelivery);
  }

  function mountIntoDrawer() {
    const mount = document.querySelector('[data-figur-delivery="drawer"]');
    if (!mount || mount.querySelector('cart-delivery')) return;
    const savedDate = window.__cartAttributes?.['_Delivery Date'] ?? '';
    const savedSlot = window.__cartAttributes?.['_Delivery Slot'] ?? '';
    mount.innerHTML = `
      <p class="cart-delivery__title">Scheduled Delivery</p>
      <cart-delivery
        class="cart-delivery"
        data-attr-date="Delivery Date"
        data-attr-slot="Delivery Slot"
        data-saved-date="${savedDate}"
        data-saved-slot="${savedSlot}"
        data-slot-placeholder="Select delivery time"
        data-error-text="Please select a delivery date and time before checking out."
      >
        <div class="cart-delivery__calendar-wrap">
          <input type="text" class="cart-delivery__date-input" value="${savedDate}" readonly aria-hidden="true" tabindex="-1">
        </div>
        <div class="cart-delivery__time-field">
          <select class="cart-delivery__slot-select" aria-label="Delivery time slot">
            <option value="">Select delivery time</option>
          </select>
          <button type="button" class="cart-delivery__time-icon" aria-hidden="true" tabindex="-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <p class="cart-delivery__helper">Choose your preferred delivery date and time.</p>
        <p class="cart-delivery__error" role="alert" hidden>Please select a delivery date and time before checking out.</p>
      </cart-delivery>
    `;
  }

  document.addEventListener('DOMContentLoaded', mountIntoDrawer);
  document.addEventListener('cart:open', mountIntoDrawer);
})();
