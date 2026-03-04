import { Controller, Post } from "@nestjs/common";
import { RssService } from "./rss.service";

@Controller("rss")
export class RssController {
  constructor(private readonly rss: RssService) {}

  @Post("collect")
  async collect() {
    return this.rss.runCollection();
  }
}
