interface SessionValue<T> {
  value?: T
}

export interface SessionResponse {
  namespaces?: {
    authentication?: {
      storeUserId?: SessionValue<string>
    }
    profile?: {
      isAuthenticated?: SessionValue<boolean | string>
    }
  }
}
