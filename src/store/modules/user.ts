import { defineStore } from 'pinia'
import { createUserIsolatedStorage } from '@/utils/userIsolatedStorage'

export const useUserStore = defineStore('user', {
  state: () => ({
    name: '',
    token: '',
    isLogin: false
  }),
  
  actions: {
    setUserInfo(name: string, token: string) {
      this.name = name
      this.token = token
      this.isLogin = true
    },
    
    clearUserInfo() {
      this.name = ''
      this.token = ''
      this.isLogin = false
    }
  },
  
  persist: {
    key: 'user-store',
    storage: createUserIsolatedStorage(),
    paths: ['name', 'token', 'isLogin']
  }
}) 