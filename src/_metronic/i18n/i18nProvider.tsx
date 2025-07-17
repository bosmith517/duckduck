import {FC} from 'react'
import {IntlProvider} from 'react-intl'
import '@formatjs/intl-relativetimeformat/polyfill'
import '@formatjs/intl-relativetimeformat/locale-data/en'
import '@formatjs/intl-relativetimeformat/locale-data/de'
import '@formatjs/intl-relativetimeformat/locale-data/es'
import '@formatjs/intl-relativetimeformat/locale-data/fr'
import '@formatjs/intl-relativetimeformat/locale-data/ja'
import '@formatjs/intl-relativetimeformat/locale-data/zh'

import deMessages from './messages/de.json'
import enMessages from './messages/en.json'
import esMessages from './messages/es.json'
import frMessages from './messages/fr.json'
import jaMessages from './messages/ja.json'
import zhMessages from './messages/zh.json'
import {WithChildren} from '../helpers'

const allMessages = {
  de: deMessages,
  en: enMessages,
  es: esMessages,
  fr: frMessages,
  ja: jaMessages,
  zh: zhMessages,
}

const I18nProvider: FC<WithChildren> = ({children}) => {
  // Get the saved language from localStorage directly to avoid context issues
  const I18N_CONFIG_KEY = import.meta.env.VITE_APP_I18N_CONFIG_KEY || 'i18nConfig'
  let locale: keyof typeof allMessages = 'en' // default
  
  try {
    const ls = localStorage.getItem(I18N_CONFIG_KEY)
    if (ls) {
      const config = JSON.parse(ls)
      if (config.selectedLang && allMessages[config.selectedLang as keyof typeof allMessages]) {
        locale = config.selectedLang as keyof typeof allMessages
      }
    }
  } catch (error) {
    console.error('Error loading language preference:', error)
  }
  
  const messages = allMessages[locale]

  return (
    <IntlProvider locale={locale} messages={messages || enMessages}>
      {children as any}
    </IntlProvider>
  )
}

export {I18nProvider}
