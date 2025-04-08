/**
 * FormValidator class for handling form validation with phone and email inputs
 * @class
 */
class FormValidator {
    /**
     * Create a new FormValidator instance
     * @param {string} selector - CSS selector for the form root element
     * @param {Object} options - Configuration options
     * @param {number} [options.minDigits=6] - Minimum number of digits required in phone number
     * @param {string} [options.allowedChars='- '] - Allowed special characters in phone number
     * @param {string} [options.firstDigits=''] - Required first digits for phone number
     * @param {boolean} [options.detectCountry=true] - Whether to detect user's country
     * @param {boolean} [options.disableSubmit=true] - Whether to disable submit button until valid
     * @param {string} [options.errorClass='invalid'] - CSS class for error state
     * @param {string} [options.successClass='valid'] - CSS class for success state
     */
    constructor(selector, options = {}) {
        this.root = document.querySelector(selector);
        if (!this.root) {
            console.error(`Form element not found with selector: ${selector}`);
            return;
        }

        this.options = {
            minDigits: 6,
            allowedChars: '- ',
            firstDigits: '',
            detectCountry: true,
            disableSubmit: true,
            errorClass: 'invalid',
            successClass: 'valid',
            ...options,
        };

        this.elements = {
            submitButton: this.root.querySelector('[fv-submit]'),
            phoneInput: this.root.querySelector('[fv-phone]'),
            emailInput: this.root.querySelector('[fv-email]'),
            countryElements: this.root.querySelectorAll('[fv-country]'),
            mainFlag: this.root.querySelector('[fv-main-flag]')
        };

        this.state = {
            isValid: false,
            phoneValid: false,
            emailValid: false
        };

        this.eventListeners = new Map();
    }

    /**
     * Initialize the form validator
     */
    mount() {
        if (!this.root) return;

        this.setupCountryDetection();
        this.setupEventListeners();
        this.validateForm();
    }

    /**
     * Clean up event listeners and references
     */
    destroy() {
        this.eventListeners.forEach((listener, element) => {
            element.removeEventListener(listener.type, listener.fn);
        });
        this.eventListeners.clear();
    }

    /**
     * Set up country detection based on user's location
     * @private
     */
    setupCountryDetection() {
        if (this.options.detectCountry) {
            this.detectUserCountry();
        } else {
            this.setFirstCountry();
        }
    }

    /**
     * Detect user's country using IP geolocation
     * @private
     */
    async detectUserCountry() {
        try {
            const response = await fetch('https://ipwho.is/');
            const data = await response.json();
            
            if (data?.country_code) {
                const countryElement = this.root.querySelector(`[fv-country="${data.country_code.toUpperCase()}"]`);
                if (countryElement) {
                    this.selectCountry(countryElement);
                }
            }
        } catch (error) {
            console.error('Failed to detect country:', error);
            this.setFirstCountry();
        }
    }

    /**
     * Select the first available country
     * @private
     */
    setFirstCountry() {
        const firstCountry = this.elements.countryElements[0];
        if (firstCountry) {
            this.selectCountry(firstCountry);
        }
    }

    /**
     * Handle country selection
     * @param {HTMLElement} countryElement - The selected country element
     * @private
     */
    selectCountry(countryElement) {
        const flag = countryElement.querySelector('[fv-flag]');
        const dial = countryElement.querySelector('[fv-dial-code]');

        if (flag && this.elements.mainFlag) {
            this.elements.mainFlag.src = flag.src;
        }

        if (dial && this.elements.phoneInput) {
            const dialCode = `+${dial.textContent.trim()} `;
            this.elements.phoneInput.value = dialCode;
            this.elements.phoneInput.setAttribute('fv-dial-code', dialCode);
            this.validateForm();
        }
    }

    /**
     * Set up all event listeners
     * @private
     */
    setupEventListeners() {
        this.setupCountryClickHandlers();
        this.setupInputHandlers();
    }

    /**
     * Set up country selection event handlers
     * @private
     */
    setupCountryClickHandlers() {
        this.elements.countryElements.forEach(country => {
            const handler = () => this.selectCountry(country);
            country.addEventListener('click', handler);
            this.eventListeners.set(country, { type: 'click', fn: handler });
        });
    }

    /**
     * Set up input field event handlers
     * @private
     */
    setupInputHandlers() {
        if (this.elements.phoneInput) {
            const handler = () => this.handlePhoneInput();
            this.elements.phoneInput.addEventListener('input', handler);
            this.eventListeners.set(this.elements.phoneInput, { type: 'input', fn: handler });
        }

        if (this.elements.emailInput) {
            const handler = () => this.handleEmailInput();
            this.elements.emailInput.addEventListener('input', handler);
            this.eventListeners.set(this.elements.emailInput, { type: 'input', fn: handler });
        }
    }

    /**
     * Handle phone input changes
     * @private
     */
    handlePhoneInput() {
        const dialCode = this.elements.phoneInput.getAttribute('fv-dial-code') || '';
        let inputValue = this.elements.phoneInput.value;

        if (!inputValue.startsWith(dialCode)) {
            this.elements.phoneInput.value = dialCode;
            return;
        }

        let userInput = inputValue.slice(dialCode.length);
        userInput = this.sanitizePhoneInput(userInput);
        this.elements.phoneInput.value = dialCode + userInput;
        
        this.validateForm();
    }

    /**
     * Sanitize phone input according to rules
     * @param {string} input - The user input to sanitize
     * @returns {string} Sanitized input
     * @private
     */
    sanitizePhoneInput(input) {
        const regexSafeChars = this.options.allowedChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const regex = new RegExp(`[^0-9${regexSafeChars}]`, 'g');
        input = input.replace(regex, '');

        const doubleSpecialRegex = new RegExp(`([${regexSafeChars}])\\1+`, 'g');
        input = input.replace(doubleSpecialRegex, '$1');

        if (input.length > 0 && this.options.firstDigits && !this.options.firstDigits.includes(input.charAt(0))) {
            input = input.slice(1);
        }

        if (input.length > 0 && !/^\d/.test(input.charAt(0))) {
            input = input.replace(/^./, '');
        }

        return input;
    }

    /**
     * Handle email input changes
     * @private
     */
    handleEmailInput() {
        const email = this.elements.emailInput.value.trim();
        const isValid = this.validateEmail(email);
        
        this.elements.emailInput.classList.toggle(this.options.errorClass, !isValid);
        this.elements.emailInput.classList.toggle(this.options.successClass, isValid);
        
        this.validateForm();
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Whether the email is valid
     * @private
     */
    validateEmail(email) {
        const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return regex.test(email);
    }

    /**
     * Validate the entire form
     * @private
     */
    validateForm() {
        let isPhoneValid = true;
        let isEmailValid = true;

        if (this.elements.phoneInput) {
            const dialCode = this.elements.phoneInput.getAttribute('fv-dial-code') || '';
            const userInput = this.elements.phoneInput.value.slice(dialCode.length);
            const digitCount = (userInput.match(/\d/g) || []).length;
            isPhoneValid = digitCount >= this.options.minDigits;
            
            this.elements.phoneInput.classList.toggle(this.options.errorClass, !isPhoneValid);
            this.elements.phoneInput.classList.toggle(this.options.successClass, isPhoneValid);
        }

        if (this.elements.emailInput) {
            isEmailValid = this.validateEmail(this.elements.emailInput.value);
        }

        this.state.phoneValid = isPhoneValid;
        this.state.emailValid = isEmailValid;
        this.state.isValid = isPhoneValid && isEmailValid;

        if (this.elements.submitButton && this.options.disableSubmit) {
            this.elements.submitButton.classList.toggle('fv-disable', !this.state.isValid);
        }
    }

    /**
     * Get the current validation state
     * @returns {Object} Current validation state
     */
    getValidationState() {
        return { ...this.state };
    }
}
