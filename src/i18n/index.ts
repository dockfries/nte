import { I18n } from "@infernus/core";
import en_US from "./locales/en_US.json";
import es_ES from "./locales/es_ES.json";
import id_ID from "./locales/id_ID.json";
import pt_BR from "./locales/pt_BR.json";
import ro_RO from "./locales/ro_RO.json";
import sr_RS from "./locales/sr_RS.json";
import tr_TR from "./locales/tr_TR.json";
import vi_VN from "./locales/vi_VN.json";
import zh_CN from "./locales/zh_CN.json";

const locales = { en_US, es_ES, id_ID, pt_BR, ro_RO, sr_RS, tr_TR, vi_VN, zh_CN };

export const { $t } = new I18n("en_US", locales);
