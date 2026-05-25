/**
 * WebAuthn passkey support using native browser APIs.
 *
 * Uses the stable native APIs available in all major browsers since March 2025:
 *   - PublicKeyCredential.parseCreationOptionsFromJSON()
 *   - PublicKeyCredential.parseRequestOptionsFromJSON()
 *   - PublicKeyCredential.prototype.toJSON()
 */

window.markshare = window.markshare || {};

window.markshare.passkeys = (() => {
  let _conditionalAbortController = null;

  function getCsrfToken() {
    const hxheaders = document.body.getAttribute("hx-headers") || "{}";
    const headers = JSON.parse(hxheaders);
    return headers["X-CSRFToken"] || "";
  }

  function jsonPost(url, body) {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCsrfToken(),
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Show passkey-related UI elements only when the platform supports them.
   * Call this on DOMContentLoaded.
   */
  async function initUI() {
    const webAuthnAvailable = !!(window.PublicKeyCredential && navigator.credentials);

    const conditionalOk = await (
      window.PublicKeyCredential?.isConditionalMediationAvailable?.() ?? Promise.resolve(false)
    ).catch(() => false);

    if (webAuthnAvailable) {
      document.querySelectorAll("[data-passkey-ui]").forEach((el) => el.removeAttribute("hidden"));
    } else {
      document.getElementById("no-passkey-msg")?.removeAttribute("hidden");
    }

    if (conditionalOk) {
      _startConditionalMediation();
    }
  }

  /**
   * Register a new passkey for the currently authenticated user.
   * @param {HTMLFormElement} formEl
   */
  async function register(formEl) {
    const beginUrl = formEl?.dataset.beginUrl;
    const completeUrl = formEl?.dataset.completeUrl;
    if (!beginUrl || !completeUrl) return;

    const nameInput = formEl?.querySelector("[name=name]");
    const errorEl = document.getElementById("passkey-error");
    const submitBtn = formEl?.querySelector("[type=submit]");

    try {
      if (submitBtn) submitBtn.disabled = true;
      if (errorEl) errorEl.hidden = true;

      const beginResp = await jsonPost(beginUrl, {});
      if (!beginResp.ok) {
        const err = await beginResp.json();
        throw new Error(err.error || formEl?.dataset.errorServer || "Server error");
      }
      const options = await beginResp.json();

      const credential = await navigator.credentials.create({
        publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
      });

      const completeResp = await jsonPost(completeUrl, {
        ...credential.toJSON(),
        name: nameInput?.value.trim() || "",
      });
      if (!completeResp.ok) {
        const err = await completeResp.json();
        throw new Error(err.error || formEl?.dataset.errorRegister || "Registration failed");
      }

      window.location.reload();
    } catch (err) {
      if (err.name === "NotAllowedError") {
        // user cancelled — do nothing
      } else if (err.name === "InvalidStateError") {
        if (errorEl) {
          errorEl.textContent =
            formEl?.dataset.errorDuplicate ||
            "This authenticator already has a passkey registered.";
          errorEl.hidden = false;
        }
      } else if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  /**
   * Authenticate with a passkey via an explicit button click on the login page.
   */
  async function authenticate() {
    if (_conditionalAbortController) {
      _conditionalAbortController.abort();
      _conditionalAbortController = null;
    }

    const btn = document.getElementById("btn-passkey-login");
    const beginUrl = btn?.dataset.beginUrl;
    const completeUrl = btn?.dataset.completeUrl;
    if (!beginUrl || !completeUrl) return;

    const nextUrl = btn?.dataset.nextUrl || "";
    const errorEl = document.getElementById("passkey-auth-error");

    try {
      const beginResp = await jsonPost(beginUrl, {});
      if (!beginResp.ok) throw new Error("Failed to begin authentication");
      const authOptions = await beginResp.json();

      const credential = await navigator.credentials.get({
        publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(authOptions),
      });

      const completeResp = await jsonPost(completeUrl, {
        ...credential.toJSON(),
        next: nextUrl,
      });
      if (!completeResp.ok) {
        const err = await completeResp.json();
        throw new Error(err.error || "Authentication failed");
      }
      const data = await completeResp.json();
      const redirectUrl = new URL(data.redirect_url || "/", window.location.origin);
      window.location.href =
        redirectUrl.origin === window.location.origin
          ? redirectUrl.pathname + redirectUrl.search + redirectUrl.hash
          : "/";
    } catch (err) {
      if (err.name !== "NotAllowedError" && err.name !== "AbortError") {
        if (errorEl) {
          errorEl.textContent = err.message;
          errorEl.hidden = false;
        }
      }
    }
  }

  async function _startConditionalMediation() {
    const btn = document.getElementById("btn-passkey-login");
    const beginUrl = btn?.dataset.beginUrl;
    const completeUrl = btn?.dataset.completeUrl;
    if (!beginUrl || !completeUrl) return;

    _conditionalAbortController = new AbortController();

    try {
      const beginResp = await jsonPost(beginUrl, {});
      if (!beginResp.ok) return;
      const authOptions = await beginResp.json();

      const credential = await navigator.credentials.get({
        publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(authOptions),
        mediation: "conditional",
        signal: _conditionalAbortController.signal,
      });

      if (!credential) return;

      const nextUrl = btn?.dataset.nextUrl || "";
      const completeResp = await jsonPost(completeUrl, {
        ...credential.toJSON(),
        next: nextUrl,
      });
      if (!completeResp.ok) return;
      const data = await completeResp.json();
      const redirectUrl = new URL(data.redirect_url || "/", window.location.origin);
      window.location.href =
        redirectUrl.origin === window.location.origin
          ? redirectUrl.pathname + redirectUrl.search + redirectUrl.hash
          : "/";
    } catch (_err) {
      // Expected: aborted when user clicks the login button directly.
    }
  }

  /**
   * Wire up the registration page form submit handler.
   */
  function initRegisterForm() {
    const form = document.getElementById("register-form");
    if (!form) return;

    form.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const username = form.querySelector("[name=username]").value.trim();
      const errorEl = document.getElementById("passkey-error");

      if (errorEl) errorEl.hidden = true;

      const usernameUrl = form.dataset.usernameUrl;
      if (usernameUrl) {
        const resp = await jsonPost(usernameUrl, { username });
        if (!resp.ok) {
          const err = await resp.json();
          if (errorEl) {
            errorEl.textContent = err.error || "Could not validate username.";
            errorEl.hidden = false;
          }
          return;
        }
      }

      register(form);
    });
  }

  return { initUI, initRegisterForm, register, authenticate };
})();
