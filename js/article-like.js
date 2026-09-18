(function () {
  'use strict'

  const SUPABASE_URL = 'https://evwnyynurpydufksoqmx.supabase.co'
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable__iMCXcz6x-q8CJrm1FaeGA_TZZP2NtM'
  const VOTER_STORAGE_KEY = 'gcblog:article-like:voter-id'
  const WIDGET_ID = 'article-like'

  function createUuid () {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID()
    }

    const bytes = new Uint8Array(16)
    window.crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  function getVoterId () {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    let voterId = window.localStorage.getItem(VOTER_STORAGE_KEY)

    if (!uuidPattern.test(voterId || '')) {
      voterId = createUuid()
      window.localStorage.setItem(VOTER_STORAGE_KEY, voterId)
    }

    return voterId
  }

  function getArticlePath () {
    try {
      return decodeURI(window.location.pathname)
    } catch (error) {
      return window.location.pathname
    }
  }

  async function callRpc (functionName, payload) {
    const response = await window.fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Article like request failed: ${response.status}`)
    }

    const result = await response.json()
    return Array.isArray(result) ? result[0] : result
  }

  function updateButton (button, state) {
    const count = Number(state.like_count || 0)
    const liked = Boolean(state.liked)
    const icon = button.querySelector('.article-like__icon')
    const label = button.querySelector('.article-like__label')
    const countElement = button.querySelector('.article-like__count')

    button.disabled = false
    button.setAttribute('aria-pressed', String(liked))
    button.setAttribute('aria-label', liked ? `取消点赞，当前 ${count} 个赞` : `为文章点赞，当前 ${count} 个赞`)
    icon.className = `${liked ? 'fas' : 'far'} fa-heart article-like__icon`
    label.textContent = liked ? '已点赞' : '喜欢这篇文章'
    countElement.textContent = String(count)
  }

  function showError (widget, button) {
    button.disabled = true
    button.setAttribute('aria-label', '点赞功能暂不可用')
    button.querySelector('.article-like__label').textContent = '点赞暂不可用'
    widget.querySelector('.article-like__status').textContent = '请稍后再试'
  }

  async function mountArticleLike () {
    const article = document.querySelector('#post > #article-container.post-content')
    const existingWidget = document.getElementById(WIDGET_ID)

    if (existingWidget) existingWidget.remove()
    if (!article) return

    const widget = document.createElement('div')
    widget.id = WIDGET_ID
    widget.className = 'article-like'
    widget.innerHTML = `
      <button class="article-like__button" type="button" aria-pressed="false" disabled>
        <i class="far fa-heart article-like__icon" aria-hidden="true"></i>
        <span class="article-like__label">正在加载</span>
        <span class="article-like__count" aria-hidden="true">0</span>
      </button>
      <span class="article-like__status" aria-live="polite"></span>
    `
    article.insertAdjacentElement('afterend', widget)

    const button = widget.querySelector('.article-like__button')
    const payload = {
      p_path: getArticlePath(),
      p_voter_id: getVoterId()
    }

    try {
      const initialState = await callRpc('get_article_like_state', payload)
      updateButton(button, initialState)
    } catch (error) {
      console.error(error)
      showError(widget, button)
      return
    }

    button.addEventListener('click', async function () {
      button.disabled = true
      widget.querySelector('.article-like__status').textContent = '正在提交'

      try {
        const nextState = await callRpc('toggle_article_like', payload)
        updateButton(button, nextState)
        widget.querySelector('.article-like__status').textContent = nextState.liked ? '感谢你的喜欢' : '已取消点赞'
      } catch (error) {
        console.error(error)
        showError(widget, button)
      }
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountArticleLike, { once: true })
  } else {
    mountArticleLike()
  }

  document.addEventListener('pjax:complete', mountArticleLike)
})()

