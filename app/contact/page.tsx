import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import ContactCard from '../../components/ContactCard';
export const metadata = { title: '联系我 | 沫凉的个人主页' };
export default function ContactPage() {
  return <><Navbar /><PageTransition><main className="w-full max-w-2xl mx-auto mt-24 sm:mt-28 px-4 sm:px-6 pb-10"><ContactCard /></main></PageTransition></>;
}
