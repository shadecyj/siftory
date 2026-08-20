import { SearchComposer } from "../components/search-composer";
import { HomePageContent } from "../components/home-page-content";

export default function HomePage() {
  return <HomePageContent composer={<SearchComposer />} />;
}
