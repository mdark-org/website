
import {tgLink} from "../../../config";

export async function GET(request: Request) {
  return Response.redirect(tgLink, 301)
}
