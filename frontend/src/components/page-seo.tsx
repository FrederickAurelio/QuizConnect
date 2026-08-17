import { metaForPath } from "@/lib/seo";
import { useLocation } from "react-router";

function PageSeo() {
  const { pathname } = useLocation();
  const { title, description } = metaForPath(pathname);

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
    </>
  );
}

export default PageSeo;
