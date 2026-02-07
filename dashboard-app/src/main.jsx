import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { InboxUnreadProvider } from './contexts/InboxUnreadContext'
import './index.css'
import Layout from './Layout'
import Home from './pages/Home'
import Join from './pages/Join'
import JoinService from './pages/JoinService'
import Share from './pages/Share'
import Wallet from './pages/Wallet'
import Offer from './pages/Offer'
import Profile from './pages/Profile'
import Subscription from './pages/Subscription'
import Help from './pages/Help'
import Inbox from './pages/Inbox'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Charter from './pages/Charter'
import { I18nProvider } from './contexts/I18nContext'

// English only: no locale in URL, routes at /home, /join, etc.
const router = createBrowserRouter(
  [
    {
      path: '/',
      element: (
        <I18nProvider>
          <Layout />
        </I18nProvider>
      ),
      children: [
        { index: true, element: <Home /> },
        { path: 'home', element: <Home /> },
        { path: 'join', element: <Join /> },
        { path: 'join/:service', element: <JoinService /> },
        { path: 'share', element: <Share /> },
        { path: 'wallet', element: <Wallet /> },
        { path: 'offer', element: <Offer /> },
        { path: 'profile', element: <Profile /> },
        { path: 'subscription', element: <Subscription /> },
        { path: 'help', element: <Help /> },
        { path: 'inbox', element: <Inbox /> },
        { path: 'login', element: <Login /> },
        { path: 'signup', element: <Signup /> },
        { path: 'charter', element: <Charter /> },
      ],
    },
  ],
  { basename: '' }
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <InboxUnreadProvider>
        <RouterProvider router={router} />
      </InboxUnreadProvider>
    </AuthProvider>
  </StrictMode>,
)
