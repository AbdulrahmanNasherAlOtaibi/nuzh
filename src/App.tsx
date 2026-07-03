import { Route, Switch, useLocation } from "wouter";
import { Header, BottomNav, Toast } from "./components/layout";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import MapPage from "./pages/MapPage";
import MyTrips from "./pages/MyTrips";
import Account from "./pages/Account";
import TripDetails from "./pages/TripDetails";
import Auth from "./pages/Auth";
import Help from "./pages/Help";
import Awareness from "./pages/Awareness";
import Provider from "./pages/Provider";
import AdminApp from "./admin/AdminApp";

export default function App() {
  const [loc] = useLocation();
  const isAdmin = loc.startsWith("/admin");

  if (isAdmin)
    return (
      <>
        <Toast />
        <AdminApp />
      </>
    );

  return (
    <div className="min-h-dvh pb-20">
      <Toast />
      <Header />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/explore" component={Explore} />
        <Route path="/map" component={MapPage} />
        <Route path="/my-trips" component={MyTrips} />
        <Route path="/account" component={Account} />
        <Route path="/trips/:id" component={TripDetails} />
        <Route path="/auth" component={Auth} />
        <Route path="/help" component={Help} />
        <Route path="/awareness/:kind" component={Awareness} />
        <Route path="/awareness" component={Awareness} />
        <Route path="/provider" component={Provider} />
        <Route>
          <div className="text-center py-20 opacity-60 font-bold">الصفحة غير موجودة</div>
        </Route>
      </Switch>
      <BottomNav />
    </div>
  );
}
