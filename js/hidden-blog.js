(function () {
  'use strict'

  const vault = document.getElementById('hidden-vault')
  const payloadElement = document.getElementById('hidden-vault-payload')
  if (!vault || !payloadElement) return

  const form = document.getElementById('hidden-vault-form')
  const passwordInput = document.getElementById('hidden-vault-password')
  const revealButton = document.getElementById('hidden-vault-reveal')
  const unlockButton = document.getElementById('hidden-vault-unlock')
  const status = document.getElementById('hidden-vault-status')
  const lockedView = document.getElementById('hidden-vault-locked')
  const openView = document.getElementById('hidden-vault-open')
  const list = document.getElementById('hidden-vault-list')
  const article = document.getElementById('hidden-vault-article')
  const count = document.getElementById('hidden-vault-count')
  const lockButton = document.getElementById('hidden-vault-lock')
  let decryptedArticles = []

  function decodeBase64 (value) {
    const binary = window.atob(value)
    return Uint8Array.from(binary, character => character.charCodeAt(0))
  }

  async function decryptPayload (password) {
    const payload = JSON.parse(payloadElement.textContent)
    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    )
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: decodeBase64(payload.salt),
        iterations: payload.iterations,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    )
    const plaintext = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decodeBase64(payload.iv) },
      key,
      decodeBase64(payload.data)
    )
    return JSON.parse(new TextDecoder().decode(plaintext))
  }

  function getRequestedArticleId () {
    return new URL(window.location.href).searchParams.get('note') || ''
  }

  function setRequestedArticleId (id) {
    const url = new URL(window.location.href)
    if (url.searchParams.get('note') === id) return
    url.searchParams.set('note', id)
    url.hash = ''
    window.history.replaceState(null, '', url)
  }

  function createArticleButton (item) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'hidden-vault__item'
    button.dataset.articleId = item.id

    const title = document.createElement('span')
    title.className = 'hidden-vault__item-title'
    title.textContent = item.title

    const meta = document.createElement('span')
    meta.className = 'hidden-vault__item-meta'
    meta.textContent = item.date || '未标注日期'

    button.append(title, meta)
    button.addEventListener('click', function () {
      showArticle(item.id, true)
    })
    return button
  }

  function showArticle (id, moveFocus) {
    const selected = decryptedArticles.find(item => item.id === id) || decryptedArticles[0]
    if (!selected) return

    list.querySelectorAll('.hidden-vault__item').forEach(button => {
      const active = button.dataset.articleId === selected.id
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-current', active ? 'page' : 'false')
    })

    article.innerHTML = `
      <header class="hidden-vault__article-head">
        <span>${selected.date || 'PRIVATE NOTE'}</span>
        <h2></h2>
        <p></p>
      </header>
      <div class="hidden-vault__article-body"></div>
    `
    article.querySelector('h2').textContent = selected.title
    article.querySelector('p').textContent = selected.description
    article.querySelector('.hidden-vault__article-body').innerHTML = selected.html
    setRequestedArticleId(selected.id)

    if (typeof window.btf === 'object' && typeof window.btf.loadLightbox === 'function') {
      window.btf.loadLightbox(article.querySelectorAll('img:not(.no-lightbox)'))
    }
    if (moveFocus) article.focus({ preventScroll: true })
  }

  function openVault (payload) {
    decryptedArticles = Array.isArray(payload.articles) ? payload.articles : []
    list.replaceChildren(...decryptedArticles.map(createArticleButton))
    count.textContent = `${decryptedArticles.length} 篇`
    lockedView.hidden = true
    openView.hidden = false
    vault.dataset.state = 'open'
    passwordInput.value = ''
    showArticle(getRequestedArticleId(), false)
  }

  function lockVault () {
    decryptedArticles = []
    list.replaceChildren()
    article.replaceChildren()
    openView.hidden = true
    lockedView.hidden = false
    vault.dataset.state = 'locked'
    status.textContent = ''
    const url = new URL(window.location.href)
    url.searchParams.delete('note')
    url.hash = ''
    window.history.replaceState(null, '', url)
    passwordInput.focus()
  }

  function setLoading (loading) {
    passwordInput.disabled = loading
    revealButton.disabled = loading
    unlockButton.disabled = loading
    unlockButton.querySelector('span').textContent = loading ? '正在解密…' : '解锁目录'
    unlockButton.querySelector('i').className = loading ? 'fas fa-circle-notch fa-spin' : 'fas fa-unlock-keyhole'
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault()
    const password = passwordInput.value
    if (!password) {
      status.textContent = '请输入访问密码。'
      passwordInput.focus()
      return
    }
    if (!window.crypto || !window.crypto.subtle) {
      status.textContent = '当前浏览器不支持安全解密，请升级浏览器后重试。'
      return
    }

    setLoading(true)
    status.textContent = ''
    try {
      openVault(await decryptPayload(password))
    } catch (error) {
      status.textContent = '密码不正确，请检查后重试。'
      passwordInput.select()
    } finally {
      setLoading(false)
    }
  })

  revealButton.addEventListener('click', function () {
    const reveal = passwordInput.type === 'password'
    passwordInput.type = reveal ? 'text' : 'password'
    revealButton.setAttribute('aria-pressed', String(reveal))
    revealButton.setAttribute('aria-label', reveal ? '隐藏密码' : '显示密码')
    revealButton.querySelector('i').className = reveal ? 'far fa-eye-slash' : 'far fa-eye'
    passwordInput.focus()
  })

  lockButton.addEventListener('click', lockVault)
})()
